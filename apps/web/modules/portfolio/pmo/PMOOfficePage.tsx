import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useCoveria } from "@/contexts/CoveriaContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { nanoid } from "nanoid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Crown,
  DollarSign,
  FileCheck,
  FileText,
  Flame,
  GitBranch,
  GitPullRequest,
  Hourglass,
  Inbox,
  Layers,
  Lightbulb,
  Loader2,
  LucideIcon,
  Plus,
  Scale,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { Notification } from "@shared/schema";
import { PmoCreateProjectDialog } from "./PMOOfficePage.project-dialog";
import { PMOEvidenceList } from "./PMOOfficePage.evidence-list";
import { PMOKnowledgeDocList } from "./PMOOfficePage.knowledge-doc-list";
import type {
  BasicUser,
  ConversionRequest,
  GateApproval,
  GateHistoryItem,
  PipelineItem,
  PortfolioProject,
  PortfolioUnitSummary,
  WbsApproval,
  MutationError,
} from './PMOOfficePage.types';
import {
  asText,
  badgeVariantByThreshold,
  budgetBadgeVariant,
  budgetRemainingLabel,
  buildExecutiveDecisionAgenda,
  classifyPmoDoc,
  computeEvidenceFlags,
  computeGovernanceScores,
  computeHighAttentionProjects,
  cpiLabel,
  healthBg,
  healthHex,
  isPmoDocument,
  normalizeConversionRequestStatus,
  perfBgBorder,
  perfText,
  priorityBadgeClass,
  progressBg,
  resetEvidencePanelIfEmpty,
  spiLabel,
  thresholdBg,
  thresholdBgInverse,
  utilThresholdBg,
  utilThresholdText,
  velocityBg,
  velocityText,
} from './PMOOfficePage.utils';
export { PmoCreateProjectDialog, extractBudgetRange } from "./PMOOfficePage.project-dialog";
export type { PipelineItem } from "./PMOOfficePage.types";

const PMOOfficeApprovalDialogs = lazy(() => import("./PMOOfficePage.approval-dialogs"));
const PMOChangeRequestDetailSheet = lazy(() => import("./PMOOfficePage.change-request-detail-sheet"));
const PMOOfficeRiskDialogs = lazy(() => import("./PMOOfficePage.risk-dialogs"));
const PMOOfficeReviewDialogs = lazy(() => import("./PMOOfficePage.review-dialogs"));
const PMOOfficeUploadDialog = lazy(() => import("./PMOOfficePage.upload-dialog"));
const PMOOfficeAssistantSurface = lazy(() => import("./PMOOfficePage.assistant-surface"));
const BRAIN_APPROVAL_SOURCE = "corevia_brain_layer7";

type BrainApprovalReport = {
  id: string;
  projectId?: string | null;
  suggestedProjectName?: string | null;
  businessObjective?: string | null;
  workflowStatus?: string | null;
  urgency?: string | null;
  dataClassification?: string | null;
  budgetRange?: string | null;
  estimatedBudget?: string | null;
  decisionSpineId?: string | null;
  aiAnalysis?: unknown;
  createdAt?: string | Date | null;
};

type BrainApprovalWorkbenchItem = {
  id: string;
  notificationId?: string;
  reportId?: string;
  decisionId: string;
  decisionSpineId?: string | null;
  projectId?: string | null;
  title: string;
  urgency: string;
  classification: string;
  budget: string;
  workflowStatus?: string | null;
  requestedAt?: string | null;
  reasons: string[];
  layer?: number | null;
  layerName?: string | null;
  requiredRoles?: string[];
};

type PendingBrainApproval = {
  approvalId: string;
  decisionId: string;
  decisionSpineId?: string | null;
  title?: string | null;
  classification?: string | null;
  urgency?: string | null;
  requestedAt?: string | null;
  reasons?: string[];
  layer?: number | null;
  layerName?: string | null;
  requiredRoles?: string[];
};

function asRecordValue(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

export default function PMOOffice() {
  const [activeTab, setActiveTab] = useState("overview");
  const [approvalSubTab, setApprovalSubTab] = useState("conversion");
  const [location, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const { onlineUsers } = useWebSocket();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { voiceEnabled, toggleVoice, isSpeaking, stopSpeaking } = useCoveria();

  /* ── COREVIA Chat State ── */
  const [pmoChatOpen, setPmoChatOpen] = useState(false);
  const approvalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab !== "approvals" || globalThis.window === undefined || globalThis.window.innerWidth >= 1024) {
      return;
    }

    approvalContentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeTab, approvalSubTab]);

  useEffect(() => {
    const query = location.split("?")[1] || (globalThis.window?.location.search || "").replace(/^\?/, "");
    if (!query) return;
    const params = new URLSearchParams(query);
    if (params.get("tab") === "approvals") {
      setActiveTab("approvals");
    }
    if (params.get("lane") === "brain") {
      setApprovalSubTab("brain");
    }
  }, [location]);

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [viewDetailsDialogOpen, setViewDetailsDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ConversionRequest | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [pmoUploadFile, setPmoUploadFile] = useState<File | null>(null);
  const [pmoUploadClassification, setPmoUploadClassification] = useState("Guidelines");
  const [pmoUploadCategory, setPmoUploadCategory] = useState("strategic");
  const [pmoUploadTags, setPmoUploadTags] = useState("");
  const [pmoUploadAccess, setPmoUploadAccess] = useState<"public" | "internal" | "restricted">("internal");
  const [pmoUploadInputKey, setPmoUploadInputKey] = useState(0);
  const [pmoUploadDialogOpen, setPmoUploadDialogOpen] = useState(false);
  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false);
  const [createPortfolioUnitDialogOpen, setCreatePortfolioUnitDialogOpen] = useState(false);
  const [portfolioUnitName, setPortfolioUnitName] = useState("");
  const [portfolioUnitSector, setPortfolioUnitSector] = useState("");
  const [portfolioUnitDescription, setPortfolioUnitDescription] = useState("");
  const [portfolioUnitManagerUserId, setPortfolioUnitManagerUserId] = useState("");
  const [selectedUnitIdForMembership, setSelectedUnitIdForMembership] = useState<string>("");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<'manager' | 'analyst' | 'viewer'>('analyst');
  const [selectedUnitIdForProject, setSelectedUnitIdForProject] = useState<string>("");
  const [selectedProjectIdForUnit, setSelectedProjectIdForUnit] = useState<string>("");
  const [projectsSnapshotSegment, setProjectsSnapshotSegment] = useState<string>("all");
  const [evidencePanelOpen, setEvidencePanelOpen] = useState(false);
  const [_evidencePanelDismissed, setEvidencePanelDismissed] = useState(false);
  const [evidenceVerifyingId, setEvidenceVerifyingId] = useState<string | null>(null);
  const [evidenceVerifyNotes, setEvidenceVerifyNotes] = useState<Record<string, string>>({});
  const updateEvidenceNote = (id: string, value: string) =>
    setEvidenceVerifyNotes((prev) => ({ ...prev, [id]: value }));
  const clearEvidenceNote = (id: string) =>
    setEvidenceVerifyNotes((prev) => ({ ...prev, [id]: '' }));
  const [evidenceFilter, setEvidenceFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [evidencePreviewTask, setEvidencePreviewTask] = useState<string | null>(null);
  // Portfolio health overview is fixed to delivery health posture for PMO use.

  /* ── PMO Notifications ── */
  const { data: pmoNotificationsData } = useQuery({
    queryKey: ["/api/notifications/pmo"],
    queryFn: async () => {
      const response = await fetch("/api/notifications?limit=20", { credentials: "include" });
      if (!response.ok) return [];
      const result = await response.json();
      return (result.data || []) as Notification[];
    },
    refetchInterval: 30000,
  });
  const pmoNotifications = useMemo(
    () => (Array.isArray(pmoNotificationsData) ? pmoNotificationsData : []),
    [pmoNotificationsData],
  );
  const _unreadNotificationCount = pmoNotifications.filter(n => !n.isRead).length;

  const _markNotificationRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/pmo"] });
    } catch {}
  };
  const _deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/pmo"] });
    } catch {}
  };

  const { data: portfolioSummary } = useQuery<{
    success: boolean;
    data: {
      totalProjects: number;
      totalBudget: number;
      totalSpend: number;
      avgProgress: number;
      byHealth: { on_track: number; at_risk: number; critical: number };
      byPhase: Record<string, number>;
    };
  }>({
    queryKey: ["/api/portfolio/summary"],
  });

  const { data: portfolioStats } = useQuery<{
    success: boolean;
    data: {
      totalProjects: number;
      activeProjects: number;
      completedProjects: number;
      atRiskProjects: number;
      totalBudget: number;
      utilizationRate: number;
    };
  }>({
    queryKey: ["/api/portfolio/stats"],
  });

  const { data: demandStats } = useQuery<{ total: number; pending: number; approved: number }>({
    queryKey: ["/api/demand-reports/stats"],
  });

  const { data: allProjectsData } = useQuery<{ success: boolean; data: PortfolioProject[] }>({
    queryKey: ["/api/portfolio/projects"],
  });

  const { data: allUsersData } = useQuery<{ success?: boolean; data?: BasicUser[] } | BasicUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: portfolioUnitsData } = useQuery<{ success: boolean; data: PortfolioUnitSummary[] }>({
    queryKey: ["/api/portfolio/units"],
  });

  const { data: conversionRequestsData, isLoading: requestsLoading } = useQuery<{ success: boolean; requests: ConversionRequest[] }>({
    queryKey: ["/api/demand-conversion-requests"],
  });

  const { data: pipelineData } = useQuery<{ success: boolean; data: PipelineItem[] }>({
    queryKey: ["/api/portfolio/pipeline"],
  });

  const { data: brainApprovalReportsData, isLoading: brainApprovalsLoading } = useQuery<{ success: boolean; data: BrainApprovalReport[] }>({
    queryKey: ["/api/demand-reports/brain-approvals"],
    queryFn: async () => {
      const response = await fetch("/api/demand-reports/brain-approvals", { credentials: "include" });
      if (!response.ok) return { success: false, data: [] };
      const result = await response.json();
      return { success: true, data: Array.isArray(result.data) ? result.data : [] };
    },
    refetchInterval: 30000,
  });

  const { data: pendingBrainApprovalsData, isLoading: pendingBrainApprovalsLoading } = useQuery<{ success: boolean; data: PendingBrainApproval[] }>({
    queryKey: ["/api/corevia/decisions/pending-approvals"],
    queryFn: async () => {
      const response = await fetch("/api/corevia/decisions/pending-approvals", { credentials: "include" });
      if (!response.ok) return { success: false, data: [] };
      const result = await response.json();
      return { success: true, data: Array.isArray(result.data) ? result.data : [] };
    },
    refetchInterval: 30000,
  });

  const { data: qaAuditData } = useQuery<{ success: boolean; data: Array<{ project: { id: string; projectName: string; projectCode: string }; summary: { pendingEvidence: number; approvedEvidence: number; rejectedEvidence: number; tasksWithEvidence: number; totalTasks: number }; tasks: Array<{ id: string; taskId: string; taskCode: string | null; title: string | null; taskType: string; status: string; evidenceSource: 'task' | 'document'; evidenceFileName: string | null; evidenceUrl: string | null; evidenceUploadedAt: string | null; evidenceUploadedBy: string | null; evidenceVerificationStatus: string | null; evidenceVerifiedAt: string | null; evidenceVerificationNotes?: string | null }> }> }>({
    queryKey: ["/api/portfolio/qa/audit"],
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: {
      creationMode: 'conversion' | 'direct';
      demandReportId?: string;
      projectName: string;
      priority: string;
      projectType: string;
      projectManager: string;
      estimatedBudget: string;
      targetDate: string;
      strategicObjective: string;
      workspacePath: 'standard' | 'accelerator';
      organizationName: string;
      department: string;
      requestorName: string;
      requestorEmail: string;
      industryType: string;
      currentChallenges: string;
      expectedOutcomes: string;
      successCriteria: string;
      stakeholders: string;
      riskFactors: string;
      dataClassification: string;
    }) => {
      const response = data.creationMode === 'conversion'
        ? await apiRequest("POST", "/api/demand-conversion-requests", {
            demandId: data.demandReportId,
            projectName: data.projectName,
            projectDescription: data.strategicObjective,
            priority: data.priority,
            proposedBudget: data.estimatedBudget ? Number.parseFloat(data.estimatedBudget.replaceAll(/[^0-9.]/g, '')) : null,
            proposedEndDate: data.targetDate || null,
            conversionData: {
              projectType: data.projectType,
              projectManager: data.projectManager,
              workspacePath: data.workspacePath,
              strategicObjective: data.strategicObjective,
            },
          })
        : await apiRequest("POST", "/api/portfolio/projects", {
            directCreate: true,
            projectName: data.projectName,
            projectDescription: data.strategicObjective,
            priority: data.priority,
            projectType: data.projectType,
            projectManager: data.projectManager,
            approvedBudget: data.estimatedBudget ? data.estimatedBudget.replaceAll(/[^0-9.]/g, '') : undefined,
            plannedEndDate: data.targetDate || undefined,
            workspacePath: data.workspacePath,
            organizationName: data.organizationName || undefined,
            department: data.department || undefined,
            requestorName: data.requestorName || undefined,
            requestorEmail: data.requestorEmail || undefined,
            industryType: data.industryType || undefined,
            currentChallenges: data.currentChallenges || undefined,
            expectedOutcomes: data.expectedOutcomes || undefined,
            successCriteria: data.successCriteria || undefined,
            stakeholders: data.stakeholders || undefined,
            riskFactors: data.riskFactors || undefined,
            dataClassification: data.dataClassification || undefined,
          });
      return response.json();
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demand-conversion-requests"] });
      setCreateProjectDialogOpen(false);
      if (variables.creationMode === 'conversion') {
        setActiveTab('approvals');
        setApprovalSubTab('conversion');
      }

      // Invalidate demand queries so the linked demand shows up immediately
      if (variables.creationMode === 'direct' && result?.demandReportId) {
        queryClient.invalidateQueries({ queryKey: ["/api/demand-reports"] });
      }

      toast({
        title: variables.creationMode === 'conversion' ? 'Project submitted for PMO approval' : 'Project created',
        description: variables.creationMode === 'conversion'
          ? 'The new project request is now in the PMO conversion queue.'
          : 'Project created and linked to a demand record. You can generate documents from the demand page when ready.',
      });
    },
    onError: (error: MutationError) => {
      toast({
        title: t('pmo.office.error'),
        description: error.message || 'Failed to create the project.',
        variant: 'destructive',
      });
    },
  });

  const createPortfolioUnitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/portfolio/units", {
        name: portfolioUnitName,
        sector: portfolioUnitSector,
        description: portfolioUnitDescription,
        managerUserId: portfolioUnitManagerUserId || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/units"] });
      setCreatePortfolioUnitDialogOpen(false);
      setPortfolioUnitName("");
      setPortfolioUnitSector("");
      setPortfolioUnitDescription("");
      setPortfolioUnitManagerUserId("");
      toast({ title: "Portfolio unit created", description: "New portfolio management unit is now active in PMO." });
    },
    onError: (error: MutationError) => {
      toast({ title: "Create failed", description: error.message || "Unable to create portfolio unit", variant: "destructive" });
    },
  });

  const addPortfolioUnitMemberMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/portfolio/units/${selectedUnitIdForMembership}/members`, {
        memberUserId,
        role: memberRole,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/units"] });
      setMemberUserId("");
      toast({ title: "Access updated", description: "Portfolio unit access member added." });
    },
    onError: (error: MutationError) => {
      toast({ title: "Access update failed", description: error.message || "Unable to add member", variant: "destructive" });
    },
  });

  const assignProjectToUnitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/portfolio/units/${selectedUnitIdForProject}/projects/${selectedProjectIdForUnit}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/units"] });
      toast({ title: "Project linked", description: "Project is now linked to the selected portfolio management unit." });
    },
    onError: (error: MutationError) => {
      toast({ title: "Link failed", description: error.message || "Unable to link project to portfolio unit", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const response = await apiRequest("PUT", `/api/demand-conversion-requests/${id}/approve`, { decisionNotes: notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-conversion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/pipeline"] });
      setApproveDialogOpen(false);
      setSelectedRequest(null);
      setDecisionNotes("");
      toast({
        title: t('pmo.office.requestApproved'),
        description: t('pmo.office.requestApprovedDesc'),
      });
    },
    onError: (error: MutationError) => {
      toast({
        title: t('pmo.office.error'),
        description: error.message || t('pmo.office.failedApproveRequest'),
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason, notes }: { id: string; reason: string; notes: string }) => {
      const response = await apiRequest("PUT", `/api/demand-conversion-requests/${id}/reject`, {
        rejectionReason: reason,
        decisionNotes: notes
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-conversion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/pipeline"] });
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
      setDecisionNotes("");
      toast({
        title: t('pmo.office.requestRejected'),
        description: t('pmo.office.requestRejectedDesc'),
      });
    },
    onError: (error: MutationError) => {
      toast({
        title: t('pmo.office.error'),
        description: error.message || t('pmo.office.failedRejectRequest'),
        variant: "destructive",
      });
    },
  });

  const { data: wbsApprovalsData, isLoading: wbsApprovalsLoading } = useQuery<{ success: boolean; data: WbsApproval[] }>({
    queryKey: ["/api/portfolio/wbs/approvals/pending"],
  });

  const [selectedWbsApproval, setSelectedWbsApproval] = useState<WbsApproval | null>(null);
  const [wbsApproveDialogOpen, setWbsApproveDialogOpen] = useState(false);
  const [wbsRejectDialogOpen, setWbsRejectDialogOpen] = useState(false);
  const [wbsReviewNotes, setWbsReviewNotes] = useState("");
  const [wbsRejectionReason, setWbsRejectionReason] = useState("");

  const approveWbsMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/portfolio/wbs/approval/${id}/approve`, { notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/wbs/approvals/pending"] });
      setWbsApproveDialogOpen(false);
      setSelectedWbsApproval(null);
      setWbsReviewNotes("");
      toast({
        title: t('pmo.office.wbsApproved'),
        description: t('pmo.office.wbsApprovedDesc'),
      });
    },
    onError: (error: MutationError) => {
      toast({
        title: t('pmo.office.error'),
        description: error.message || t('pmo.office.failedApproveWbs'),
        variant: "destructive",
      });
    },
  });

  const rejectWbsMutation = useMutation({
    mutationFn: async ({ id, reason, notes }: { id: string; reason: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/portfolio/wbs/approval/${id}/reject`, {
        rejectionReason: reason,
        notes
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/wbs/approvals/pending"] });
      setWbsRejectDialogOpen(false);
      setSelectedWbsApproval(null);
      setWbsRejectionReason("");
      setWbsReviewNotes("");
      toast({
        title: t('pmo.office.wbsRejected'),
        description: t('pmo.office.wbsRejectedDesc'),
      });
    },
    onError: (error: MutationError) => {
      toast({
        title: t('pmo.office.error'),
        description: error.message || t('pmo.office.failedRejectWbs'),
        variant: "destructive",
      });
    },
  });

  const pendingWbsApprovals = wbsApprovalsData?.data || [];

  // ─── Risk Register Approvals (PMO inbox) ───────────────────────────────
  type RiskApprovalItem = {
    projectId: string;
    projectName: string;
    projectManagerId?: string | null;
    status: string;
    version: number;
    submittedBy?: string | null;
    submittedAt?: string | null;
    submissionNotes?: string | null;
    stats?: { total: number; critical: number; high: number; medium: number; low: number; categoriesCovered: number };
    snapshot?: Record<string, unknown>;
    lastUpdatedAt?: string | null;
  };
  const { data: riskApprovalsData, isLoading: riskApprovalsLoading } = useQuery<{ success: boolean; data: RiskApprovalItem[] }>({
    queryKey: ["/api/portfolio/risk-register/approvals/pending"],
  });
  const pendingRiskApprovals = riskApprovalsData?.data || [];
  const [selectedRiskApproval, setSelectedRiskApproval] = useState<RiskApprovalItem | null>(null);
  const [riskApproveDialogOpen, setRiskApproveDialogOpen] = useState(false);
  const [riskRejectDialogOpen, setRiskRejectDialogOpen] = useState(false);
  const [riskReviewNotes, setRiskReviewNotes] = useState("");
  const [riskRejectionReason, setRiskRejectionReason] = useState("");

  const approveRiskMutation = useMutation({
    mutationFn: async ({ projectId, notes }: { projectId: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/portfolio/projects/${projectId}/risk-register/approval/approve`, { notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/risk-register/approvals/pending"] });
      setRiskApproveDialogOpen(false);
      setSelectedRiskApproval(null);
      setRiskReviewNotes("");
      toast({ title: "Risk register approved", description: "The PM has been notified and the register is locked as the risk baseline." });
    },
    onError: (error: MutationError) => {
      toast({ title: t('pmo.office.error'), description: error.message || "Failed to approve risk register", variant: "destructive" });
    },
  });

  const rejectRiskMutation = useMutation({
    mutationFn: async ({ projectId, reason, notes }: { projectId: string; reason: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/portfolio/projects/${projectId}/risk-register/approval/reject`, { reason, notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/risk-register/approvals/pending"] });
      setRiskRejectDialogOpen(false);
      setSelectedRiskApproval(null);
      setRiskRejectionReason("");
      setRiskReviewNotes("");
      toast({ title: "Risk register returned", description: "The PM has been notified to revise the register." });
    },
    onError: (error: MutationError) => {
      toast({ title: t('pmo.office.error'), description: error.message || "Failed to reject risk register", variant: "destructive" });
    },
  });

  const { data: gateApprovalsData, isLoading: gateApprovalsLoading } = useQuery<{ success: boolean; data: GateApproval[] }>({
    queryKey: ["/api/portfolio/gates/pending"],
  });

  const { data: gateHistoryData, isLoading: _gateHistoryLoading } = useQuery<{ success: boolean; data: GateHistoryItem[] }>({
    queryKey: ["/api/portfolio/gates/history"],
  });
  const gateHistory = gateHistoryData?.data || [];

  const [selectedGateApproval, setSelectedGateApproval] = useState<GateApproval | null>(null);
  const [gateApproveDialogOpen, setGateApproveDialogOpen] = useState(false);
  const [gateRejectDialogOpen, setGateRejectDialogOpen] = useState(false);
  const [gateReviewNotes, setGateReviewNotes] = useState("");
  const [gateRejectionReason, setGateRejectionReason] = useState("");

  const approveGateMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/portfolio/gates/${id}/approve`, {
        reviewNotes: notes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/gates/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/gates/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gates"] });
      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio/projects", data.projectId] });
        queryClient.invalidateQueries({ queryKey: ["/api/gates", data.projectId, "status"] });
      }
      setGateApproveDialogOpen(false);
      setSelectedGateApproval(null);
      setGateReviewNotes("");
      toast({
        title: t('pmo.office.gateApproved'),
        description: data.message || t('pmo.office.gateApprovedDesc'),
      });
    },
    onError: (error: MutationError) => {
      toast({
        title: t('pmo.office.error'),
        description: error.message || t('pmo.office.failedApproveGate'),
        variant: "destructive",
      });
    },
  });

  const rejectGateMutation = useMutation({
    mutationFn: async ({ id, reason, notes }: { id: string; reason: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/portfolio/gates/${id}/reject`, {
        reviewNotes: `${reason}\n\n${notes}`,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/gates/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/gates/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gates"] });
      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio/projects", data.projectId] });
        queryClient.invalidateQueries({ queryKey: ["/api/gates", data.projectId, "status"] });
      }
      setGateRejectDialogOpen(false);
      setSelectedGateApproval(null);
      setGateRejectionReason("");
      setGateReviewNotes("");
      toast({
        title: t('pmo.office.gateRejected'),
        description: data.message || t('pmo.office.gateRejectedDesc'),
      });
    },
    onError: (error: MutationError) => {
      toast({
        title: t('pmo.office.error'),
        description: error.message || t('pmo.office.failedRejectGate'),
        variant: "destructive",
      });
    },
  });

  const pendingGateApprovals = gateApprovalsData?.data || [];

  const { data: changeRequestsData } = useQuery<{ success: boolean; data: Record<string, unknown>[] }>({
    queryKey: ["/api/portfolio/change-requests/all"],
  });

  const { data: knowledgeDocsData } = useQuery<{ success: boolean; data: Record<string, unknown>[] }>({
    queryKey: ["/api/knowledge/documents?limit=8&sortBy=newest"],
  });

  const { data: knowledgeDocStats } = useQuery<{ success: boolean; data: Record<string, unknown> }>({
    queryKey: ["/api/knowledge/documents/stats"],
  });

  const { data: knowledgeInsights } = useQuery<{ success: boolean; data: Record<string, unknown> }>({
    queryKey: ["/api/knowledge/insights/dashboard"],
  });

  const changeRequests = (changeRequestsData?.data || []).map((cr: Record<string, unknown>) => ({
    id: (cr.id || '') as string,
    projectId: (cr.project_id || cr.projectId || '') as string,
    projectName: (cr.project_name || cr.projectName || 'Unknown Project') as string,
    code: (cr.change_request_code || cr.changeRequestCode || '') as string,
    title: (cr.title || '') as string,
    description: (cr.description || '') as string,
    changeType: (cr.change_type || cr.changeType || 'other') as string,
    impact: (cr.impact || 'medium') as string,
    urgency: (cr.urgency || 'normal') as string,
    status: (cr.status || 'draft') as string,
    justification: (cr.justification || '') as string,
    requestedAt: (cr.requested_at || cr.requestedAt || new Date().toISOString()) as string,
    requestedBy: (cr.requested_by || cr.requestedBy || '') as string,
    estimatedScheduleImpact: Number(cr.estimated_schedule_impact || cr.estimatedScheduleImpact || 0),
    estimatedCostImpact: Number(cr.estimated_cost_impact || cr.estimatedCostImpact || 0),
    reviewedAt: (cr.reviewed_at || cr.reviewedAt || null) as string | null,
    reviewedBy: (cr.reviewed_by || cr.reviewedBy || null) as string | null,
    reviewNotes: (cr.review_notes || cr.reviewNotes || null) as string | null,
    affectedTasks: (cr.affected_tasks || cr.affectedTasks || []) as string[],
    originalValue: (cr.original_value || cr.originalValue || null) as Record<string, unknown> | null,
    proposedValue: (cr.proposed_value || cr.proposedValue || null) as Record<string, unknown> | null,
    approvedBy: (cr.approved_by || cr.approvedBy || null) as string | null,
    approvedAt: (cr.approved_at || cr.approvedAt || null) as string | null,
    approvalNotes: (cr.approval_notes || cr.approvalNotes || null) as string | null,
    rejectedBy: (cr.rejected_by || cr.rejectedBy || null) as string | null,
    rejectedAt: (cr.rejected_at || cr.rejectedAt || null) as string | null,
    rejectionReason: (cr.rejection_reason || cr.rejectionReason || null) as string | null,
    implementedBy: (cr.implemented_by || cr.implementedBy || null) as string | null,
    implementedAt: (cr.implemented_at || cr.implementedAt || null) as string | null,
    implementationNotes: (cr.implementation_notes || cr.implementationNotes || null) as string | null,
    businessImpact: (cr.business_impact || cr.businessImpact || null) as string | null,
    riskAssessment: (cr.risk_assessment || cr.riskAssessment || null) as string | null,
  }));

  const pendingChangeRequests = changeRequests.filter(cr => cr.status === 'submitted' || cr.status === 'under_review');

  const [selectedChangeRequest, setSelectedChangeRequest] = useState<typeof changeRequests[0] | null>(null);
  const [crDetailSheetOpen, setCrDetailSheetOpen] = useState(false);
  const [crApproveDialogOpen, setCrApproveDialogOpen] = useState(false);
  const [crRejectDialogOpen, setCrRejectDialogOpen] = useState(false);
  const [crReviewNotes, setCrReviewNotes] = useState("");
  const [crRejectionReason, setCrRejectionReason] = useState("");
  const [crImplementationNotes, setCrImplementationNotes] = useState("");

  // Fetch project WBS tasks when a CR is selected (for impact analysis)
  const { data: crProjectTasksData } = useQuery<{ success: boolean; data: Record<string, unknown>[] }>({
    queryKey: ["/api/portfolio/projects", selectedChangeRequest?.projectId, "wbs"],
    queryFn: async () => {
      if (!selectedChangeRequest?.projectId) return { success: false, data: [] };
      const res = await apiRequest("GET", `/api/portfolio/projects/${selectedChangeRequest.projectId}/wbs`);
      return res.json();
    },
    enabled: !!selectedChangeRequest?.projectId && crDetailSheetOpen,
  });

  type CrProjectTask = {
    id: string;
    taskName: string;
    title?: string;
    wbsCode?: string;
    assignedTo?: string;
    plannedStartDate?: string;
    plannedEndDate?: string;
    predecessors?: Array<string | { taskId?: string; taskCode?: string }>;
    taskType?: string;
    isMilestone?: boolean;
    priority?: string;
    parentTaskId?: string | null;
    status?: string;
    duration?: number;
  };

  const crProjectTasks: CrProjectTask[] = (crProjectTasksData?.data || []).map((t: Record<string, unknown>) => ({
    id: (t.id || '') as string,
    taskName: (t.task_name || t.taskName || t.title || '') as string,
    title: (t.title || t.task_name || t.taskName || '') as string,
    wbsCode: (t.wbs_code || t.wbsCode || '') as string,
    assignedTo: (t.assigned_to || t.assignedTo || '') as string,
    plannedStartDate: (t.planned_start_date || t.plannedStartDate || null) as string | undefined,
    plannedEndDate: (t.planned_end_date || t.plannedEndDate || null) as string | undefined,
    predecessors: (t.predecessors || []) as Array<string | { taskId?: string; taskCode?: string }>,
    taskType: (t.task_type || t.taskType || 'task') as string,
    isMilestone: (t.is_milestone || t.isMilestone || false) as boolean,
    priority: (t.priority || 'medium') as string,
    parentTaskId: (t.parent_task_id || t.parentTaskId || null) as string | null,
    status: (t.status || 'not_started') as string,
    duration: Number(t.duration || 0),
  }));

  const approveCrMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/portfolio/change-requests/${id}/approve`, { reviewNotes: notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/change-requests/all"] });
      setCrApproveDialogOpen(false);
      setCrDetailSheetOpen(false);
      setSelectedChangeRequest(null);
      setCrReviewNotes("");
      toast({ title: t('pmo.office.crApproved'), description: t('pmo.office.crApprovedDesc') });
    },
    onError: (error: MutationError) => {
      toast({ title: t('pmo.office.error'), description: error.message || t('pmo.office.crApproveFailed'), variant: "destructive" });
    },
  });

  const rejectCrMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiRequest("POST", `/api/portfolio/change-requests/${id}/reject`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/change-requests/all"] });
      setCrRejectDialogOpen(false);
      setCrDetailSheetOpen(false);
      setSelectedChangeRequest(null);
      setCrRejectionReason("");
      setCrReviewNotes("");
      toast({ title: t('pmo.office.crRejected'), description: t('pmo.office.crRejectedDesc') });
    },
    onError: (error: MutationError) => {
      toast({ title: t('pmo.office.error'), description: error.message || t('pmo.office.crRejectFailed'), variant: "destructive" });
    },
  });

  const implementCrMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/portfolio/change-requests/${id}/implement`, { implementationNotes: notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/change-requests/all"] });
      if (selectedChangeRequest?.projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio/projects", selectedChangeRequest.projectId, "wbs"] });
      }
      setCrDetailSheetOpen(false);
      setSelectedChangeRequest(null);
      setCrImplementationNotes("");
      toast({ title: t('pmo.office.crImplemented'), description: t('pmo.office.crImplementedDesc') });
    },
    onError: (error: MutationError) => {
      toast({ title: t('pmo.office.error'), description: error.message || t('pmo.office.crImplementFailed'), variant: "destructive" });
    },
  });

  const evidenceVerifyMutation = useMutation({
    mutationFn: async ({ id, source, status, notes }: { id: string; source: 'task' | 'document'; status: 'approved' | 'rejected'; notes?: string }) => {
      const endpoint = source === 'document'
        ? `/api/portfolio/evidence/${id}/verify`
        : `/api/portfolio/wbs/${id}/evidence/verify`;
      const response = await apiRequest("POST", endpoint, { status, notes });
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/qa/audit"] });
      setEvidenceVerifyingId(null);
      toast({
        title: variables.status === 'approved' ? 'Evidence Approved' : 'Evidence Rejected',
        description: variables.status === 'approved'
          ? 'Evidence has been verified and approved successfully.'
          : 'Evidence has been rejected.',
      });
    },
    onError: (error: MutationError) => {
      setEvidenceVerifyingId(null);
      toast({ title: 'Verification Failed', description: error.message || 'Failed to verify evidence', variant: 'destructive' });
    },
  });

  const conversionRequests = conversionRequestsData?.requests || [];
  const portfolioUnits = useMemo(() => portfolioUnitsData?.data ?? [], [portfolioUnitsData]);
  const allUsers = Array.isArray(allUsersData)
    ? allUsersData
    : (Array.isArray(allUsersData?.data) ? allUsersData.data : []);
  const allProjects = allProjectsData?.data || [];
  const pipelineItems = pipelineData?.data || [];
  const pendingRequests = conversionRequests.filter(r => r.status === 'pending' || r.status === 'under_review');
  const pipelinePending = pipelineItems.filter((item) => !item.hasPortfolioProject);
  const pipelineCount = pipelinePending.length;
  const [processedBrainApprovalIds, setProcessedBrainApprovalIds] = useState<Set<string>>(() => new Set());
  const pendingBrainApprovals = useMemo<BrainApprovalWorkbenchItem[]>(() => {
    const reports = brainApprovalReportsData?.data || [];
    const controlPlaneApprovals = pendingBrainApprovalsData?.data || [];
    const notificationByReportId = new Map<string, Notification>();
    for (const notification of pmoNotifications) {
      const metadata = asRecordValue(notification.metadata);
      const source = asStringValue(metadata.source);
      if (source !== BRAIN_APPROVAL_SOURCE || notification.isRead) continue;
      const reportId = asStringValue(notification.reportId) || asStringValue(metadata.reportId);
      if (reportId && !notificationByReportId.has(reportId)) {
        notificationByReportId.set(reportId, notification);
      }
    }

    const demandApprovals = reports.flatMap((report) => {
      const aiAnalysis = asRecordValue(report.aiAnalysis);
      const notification = notificationByReportId.get(report.id);
      const metadata = asRecordValue(notification?.metadata);
      const reasons = asStringList(aiAnalysis.approvalReasons).length
        ? asStringList(aiAnalysis.approvalReasons)
        : asStringList(metadata.approvalReasons);
      const finalStatus = asStringValue(aiAnalysis.finalStatus)?.toLowerCase();
      const approvalStatus = asStringValue(aiAnalysis.approvalStatus)?.toLowerCase() || "pending";
      const directorApprovalStatus = asStringValue(aiAnalysis.directorApprovalStatus)?.toLowerCase();
      const approvalRequired = aiAnalysis.approvalRequired === true || finalStatus === "pending_approval" || reasons.length > 0;
      const closedStatuses = new Set(["approved", "rejected", "revised"]);
      const isPending = approvalRequired && !closedStatuses.has(approvalStatus) && !closedStatuses.has(directorApprovalStatus || "");
      const decisionId = asStringValue(aiAnalysis.decisionId) || asStringValue(metadata.decisionId);
      if (!isPending || !decisionId) {
        return [];
      }

      const title = report.suggestedProjectName
        || asStringValue(metadata.demandTitle)
        || report.businessObjective?.substring(0, 80)
        || "Demand request";

      return [{
        id: `${report.id}:${decisionId}`,
        notificationId: notification?.id,
        reportId: report.id,
        decisionId,
        decisionSpineId: report.decisionSpineId || asStringValue(aiAnalysis.spineId) || asStringValue(metadata.decisionSpineId),
        projectId: report.projectId || null,
        title,
        urgency: report.urgency || asStringValue(metadata.urgency) || "Medium",
        classification: report.dataClassification || asStringValue(metadata.classification) || "internal",
        budget: report.budgetRange || report.estimatedBudget || asStringValue(metadata.budget) || "Not specified",
        workflowStatus: report.workflowStatus || null,
        requestedAt: asStringValue(aiAnalysis.directorApprovalRequestedAt) || asStringValue(metadata.requestedAt) || (report.createdAt ? String(report.createdAt) : null),
        reasons: reasons.length ? reasons : ["Layer 7 governance checks require PMO Director approval before downstream execution."],
      }];
    });
    const demandDecisionIds = new Set(demandApprovals.map((item) => item.decisionId));
    const genericApprovals = controlPlaneApprovals
      .filter((approval) => approval.decisionId && !demandDecisionIds.has(approval.decisionId))
      .map((approval) => ({
        id: `approval:${approval.approvalId}`,
        decisionId: approval.decisionId,
        decisionSpineId: approval.decisionSpineId || approval.decisionId,
        title: approval.title || "Corevia Brain decision",
        urgency: approval.urgency || "Medium",
        classification: approval.classification || "internal",
        budget: "N/A",
        requestedAt: approval.requestedAt || null,
        reasons: Array.isArray(approval.reasons) && approval.reasons.length
          ? approval.reasons
          : ["Decision Orchestration requires configured human approval before the next Brain layer can run."],
        layer: approval.layer ?? null,
        layerName: approval.layerName || null,
        requiredRoles: approval.requiredRoles || [],
      }));

    return [...demandApprovals, ...genericApprovals].filter((item) => !processedBrainApprovalIds.has(item.id));
  }, [brainApprovalReportsData?.data, pendingBrainApprovalsData?.data, pmoNotifications, processedBrainApprovalIds]);

  const totalPendingApprovals = pendingBrainApprovals.length + pendingRequests.length + pendingWbsApprovals.length + pendingRiskApprovals.length + pendingGateApprovals.length + pendingChangeRequests.length;
  const canRecordBrainApproval = ["pmo_director", "director", "super_admin"].includes(String(currentUser?.role || "").toLowerCase());
  const brainApprovalMutation = useMutation({
    mutationFn: async ({ item, action }: { item: BrainApprovalWorkbenchItem; action: "approve" | "revise" | "reject" }) => {
      const reasonByAction = {
        approve: "PMO Director approved the Corevia Brain Layer 7 governance gate from the PMO decision workbench.",
        revise: "PMO Director returned the Corevia Brain Layer 7 governance gate for revision from the PMO decision workbench.",
        reject: "PMO Director rejected the Corevia Brain Layer 7 governance gate from the PMO decision workbench.",
      };
      const response = await apiRequest("POST", `/api/corevia/decisions/${item.decisionId}/approve`, {
        action,
        reason: reasonByAction[action],
        approvedActions: [],
        reportId: item.reportId,
      });
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      setProcessedBrainApprovalIds((previous) => {
        const next = new Set(previous);
        next.add(variables.item.id);
        return next;
      });
      if (variables.item.notificationId) {
        await _markNotificationRead(variables.item.notificationId);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/demand-reports/brain-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/corevia/decisions/pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/pmo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/pipeline"] });
      toast({
        title: variables.action === "approve" ? "Decision Spine approved" : "Decision Spine updated",
        description: "The Brain governance gate has been recorded and synchronized back to the demand flow.",
      });
    },
    onError: (error: MutationError) => {
      toast({
        title: "Decision Spine action failed",
        description: error.message || "Only the PMO Director can record this Layer 7 governance decision.",
        variant: "destructive",
      });
    },
  });
  const pmoNavigationItems = [
    {
      id: "overview",
      label: t('pmo.office.portfolioTab'),
      hint: t('pmo.office.portfolioTabHint'),
    },
    {
      id: "approvals",
      label: t('pmo.office.approvalsTab'),
      hint: t('pmo.office.approvalsTabHint'),
      count: totalPendingApprovals,
    },
    {
      id: "governance",
      label: t('pmo.office.governanceTab'),
      hint: t('pmo.office.governanceTabHint'),
    },
    {
      id: "standards",
      label: t('pmo.office.standardsTab'),
      hint: t('pmo.office.standardsTabHint'),
    },
    {
      id: "portfolio-units",
      label: "Portfolio Units",
      hint: "Setup units, managers, access, and project linkage",
    },

  ];
  const summaryData = portfolioSummary?.data;
  const statsData = portfolioStats?.data;
  const portfolioTotal = summaryData?.totalProjects ?? statsData?.totalProjects ?? 0;
  const portfolioActive = statsData?.activeProjects ?? 0;
  const portfolioCompleted = statsData?.completedProjects ?? 0;
  const portfolioBudget = summaryData?.totalBudget ?? 0;
  const portfolioSpend = summaryData?.totalSpend ?? 0;
  const budgetUtilization = portfolioBudget > 0
    ? Math.min(Math.round((portfolioSpend / portfolioBudget) * 100), 100)
    : 0;
  const budgetRemaining = Math.max(portfolioBudget - portfolioSpend, 0);
  const budgetOverage = Math.max(portfolioSpend - portfolioBudget, 0);
  const portfolioUtilization = Math.round(statsData?.utilizationRate ?? summaryData?.avgProgress ?? 0);
  const healthBreakdown = summaryData?.byHealth ?? { on_track: 0, at_risk: 0, critical: 0 };
  const phaseBreakdown = summaryData?.byPhase ?? {};
  const healthTotal = healthBreakdown.on_track + healthBreakdown.at_risk + healthBreakdown.critical;
  const healthBase = Math.max(healthTotal, 1);
  const healthMix = {
    onTrack: Math.round((healthBreakdown.on_track / healthBase) * 100),
    atRisk: Math.round((healthBreakdown.at_risk / healthBase) * 100),
    critical: Math.round((healthBreakdown.critical / healthBase) * 100),
  };
  const _phaseEntries = Object.entries(phaseBreakdown)
    .map(([phase, count]) => ({ phase, count: Number(count) }))
    .filter((entry) => Number.isFinite(entry.count) && entry.count > 0)
    .slice(0, 4);
  const portfolioHealth = portfolioTotal > 0
    ? Math.round((healthBreakdown.on_track / portfolioTotal) * 100)
    : 0;
  const pendingDemandCount = demandStats?.pending ?? 0;
  const approvedDemandCount = demandStats?.approved ?? 0;
  const qaProjects = qaAuditData?.data || [];
  const qaPendingEvidence = qaProjects.reduce((s, p) => s + p.summary.pendingEvidence, 0);
  const qaApprovedEvidence = qaProjects.reduce((s, p) => s + p.summary.approvedEvidence, 0);
  const qaRejectedEvidence = qaProjects.reduce((s, p) => s + p.summary.rejectedEvidence, 0);
  const qaTotalEvidence = qaProjects.reduce((s, p) => s + p.tasks.length, 0);
  const pendingEvidenceItems = qaProjects.flatMap((p) =>
    p.tasks
      .filter((t) => t.evidenceFileName && t.evidenceVerificationStatus === 'pending')
      .map((t) => ({ ...t, projectName: p.project.projectName, projectId: p.project.id }))
  ).sort((a, b) => new Date(b.evidenceUploadedAt || 0).getTime() - new Date(a.evidenceUploadedAt || 0).getTime());
  // Auto-close evidence panel when no pending items remain (do NOT auto-open)
  useEffect(() => {
    resetEvidencePanelIfEmpty(pendingEvidenceItems.length, setEvidencePanelOpen, setEvidencePanelDismissed);
  }, [pendingEvidenceItems.length]);

  const knowledgeDocs = knowledgeDocsData?.data || [];
  const pmoDocs = knowledgeDocs.filter(isPmoDocument);
  const knowledgeStats = knowledgeDocStats?.data || {};
  const knowledgeStatusCounts = (knowledgeStats as { statusCounts?: Record<string, number> }).statusCounts || {};
  const knowledgeCategoryCounts = (knowledgeStats as { categoryCounts?: Record<string, number> }).categoryCounts || {};
  const _knowledgeTotal = Number((knowledgeStats as { total?: number }).total ?? knowledgeDocs.length);
  const _knowledgeProcessed = Number(knowledgeStatusCounts.completed ?? 0);
  const _knowledgePending = Number(knowledgeStatusCounts.pending ?? 0) + Number(knowledgeStatusCounts.processing ?? 0);
  const _knowledgeUnassigned = Number((knowledgeStats as { unassignedCount?: number }).unassignedCount ?? 0);
  const knowledgeLatestUpload = (knowledgeStats as { latestUpload?: string | null }).latestUpload;
  const topCategoryEntry = Object.entries(knowledgeCategoryCounts)
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const _topCategoryLabel = topCategoryEntry ? `${topCategoryEntry[0]} (${Number(topCategoryEntry[1])})` : "None";
  const _knowledgeLatestLabel = knowledgeLatestUpload
    ? new Date(knowledgeLatestUpload).toLocaleDateString()
    : "None";
  const pmoTotal = pmoDocs.length;
  const pmoProcessed = pmoDocs.filter((doc) => doc.processingStatus === "completed").length;
  const pmoPending = pmoDocs.filter((doc) => doc.processingStatus !== "completed").length;
  const pmoUnassigned = pmoDocs.filter((doc) => !doc.category).length;
  const pmoLatestUpload = pmoDocs
    .map((doc) => doc.uploadedAt)
    .filter(Boolean)
    .map((value) => new Date(String(value)))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const pmoCategoryCounts = pmoDocs.reduce<Record<string, number>>((acc, doc) => {
    const category = typeof doc.category === 'string' ? doc.category : 'Unclassified';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const pmoLatestLabel = pmoLatestUpload
    ? pmoLatestUpload.toLocaleDateString()
    : "None";
  const pmoDocsByClass = pmoDocs.reduce<Record<string, Record<string, unknown>[]>>((acc, doc) => {
    const key = classifyPmoDoc(doc);
    acc[key] ??= [];
    acc[key].push(doc);
    return acc;
  }, {});
  const pmoUploadMutation = useMutation({
    mutationFn: async () => {
      if (!pmoUploadFile) {
        throw new Error("Select a document to upload.");
      }
      const formData = new FormData();
      const normalizedClass = pmoUploadClassification.toLowerCase();
      const tags = [
        "pmo",
        normalizedClass,
        ...pmoUploadTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ];

      formData.append("file", pmoUploadFile);
      formData.append("category", pmoUploadCategory);
      formData.append("tags", JSON.stringify(Array.from(new Set(tags))));
      formData.append("accessLevel", pmoUploadAccess);
      formData.append("folderPath", `pmo/${normalizedClass}`);

      const response = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/documents"] });
      setPmoUploadFile(null);
      setPmoUploadTags("");
      setPmoUploadInputKey((value) => value + 1);
      toast({
        title: t('pmo.office.docUploaded'),
        description: t('pmo.office.docUploadedDesc'),
      });
    },
    onError: (error: MutationError) => {
      toast({
        variant: "destructive",
        title: t('pmo.office.uploadFailed'),
        description: error.message || t('pmo.office.uploadFailedDesc'),
      });
    },
  });
  const insightDashboard = knowledgeInsights?.data || {};
  const insightHealthScore = Number((insightDashboard as { healthScore?: number }).healthScore ?? 0);
  const insightAlerts = Number(((insightDashboard as { activeAlerts?: unknown[] }).activeAlerts || []).length);
  const insightCriticalGaps = Number(((insightDashboard as { gapSummary?: { criticalGaps?: number } }).gapSummary?.criticalGaps) ?? 0);
  const conversionCounts = {
    pending: pipelineItems.filter(i => !i.hasPortfolioProject && i.workflowStatus !== 'rejected').length,
    underReview: pipelineItems.filter(i => i.workflowStatus === 'under_review').length,
    approved: pipelineItems.filter(i => i.hasPortfolioProject).length,
    rejected: pipelineItems.filter(i => i.workflowStatus === 'rejected').length,
  };
  const governanceActivity: Array<{ type: string; title: string; status: string; at: string; detail: string }> = [
    ...pipelineItems
      .filter(pi => pi.hasPortfolioProject || pi.workflowStatus === 'rejected')
      .map(pi => ({
        type: 'Conversion',
        title: asText(pi.suggestedProjectName ?? pi.id, 'Demand Item'),
        status: pi.hasPortfolioProject ? 'approved' : 'rejected',
        at: pi.createdAt || '',
        detail: asText(pi.urgency),
      })),
    ...gateHistory
      .filter(g => g.reviewedAt)
      .map(g => ({
        type: 'Gate Review',
        title: asText(g.projectName, 'Project'),
        status: asText(g.gateStatus, 'reviewed'),
        at: g.reviewedAt || '',
        detail: asText(g.currentPhase),
      })),
    ...changeRequests
      .filter(cr => cr.status === 'approved' || cr.status === 'rejected')
      .map(cr => ({
        type: 'Change Request',
        title: asText(cr.projectName ?? cr.title, 'Change Request'),
        status: asText(cr.status, 'pending'),
        at: cr.reviewedAt || cr.requestedAt,
        detail: asText(cr.changeType),
      })),
  ]
    .filter((item) => item.at.length > 0)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);
  const conversionTotal = pipelineItems.length;
  const conversionSuccessRate = conversionTotal > 0
    ? Math.round((conversionCounts.approved / conversionTotal) * 100)
    : 0;
  const averageGateReadiness = gateHistory.length > 0
    ? Math.round(gateHistory.reduce((sum, gate) => sum + (gate.readinessScore || 0), 0) / gateHistory.length)
    : 0;
  const changeRequestTotals = {
    pending: pendingChangeRequests.length,
    approved: changeRequests.filter(cr => cr.status === 'approved').length,
    rejected: changeRequests.filter(cr => cr.status === 'rejected').length,
    implemented: changeRequests.filter(cr => cr.status === 'implemented').length,
  };
  const highImpactChanges = changeRequests.filter(cr => cr.impact === 'critical' || cr.impact === 'high').length;
  const projects = allProjectsData?.data || [];
  const activeExecutionProjects = projects.filter(
    (project) => project.currentPhase !== 'closure' && project.currentPhase !== 'completed' && project.currentPhase !== 'cancelled',
  );
  const portfolioUnitById = useMemo(() => new Map(portfolioUnits.map((unit) => [unit.id, unit])), [portfolioUnits]);
  const resolveProjectSnapshotSegment = useCallback((project: PortfolioProject): string => {
    const metadata = project.metadata;
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const unitId = asText((metadata as Record<string, unknown>).portfolioUnitId).trim();
      if (unitId) {
        const linkedUnit = portfolioUnitById.get(unitId);
        if (linkedUnit?.sector) return linkedUnit.sector;
        if (linkedUnit?.name) return linkedUnit.name;
      }
    }
    return 'Unassigned';
  }, [portfolioUnitById]);
  const projectsSnapshotSegments = useMemo(
    () => Array.from(new Set(activeExecutionProjects.map(resolveProjectSnapshotSegment))).sort((a, b) => a.localeCompare(b)),
    [activeExecutionProjects, resolveProjectSnapshotSegment],
  );
  const snapshotExecutionProjects = useMemo(
    () => projectsSnapshotSegment === 'all'
      ? activeExecutionProjects
      : activeExecutionProjects.filter((project) => resolveProjectSnapshotSegment(project) === projectsSnapshotSegment),
    [activeExecutionProjects, projectsSnapshotSegment, resolveProjectSnapshotSegment],
  );
  const snapshotPortfolioBudget = snapshotExecutionProjects.reduce((sum, project) => sum + Number(project.approvedBudget || 0), 0);
  const snapshotPortfolioSpend = snapshotExecutionProjects.reduce((sum, project) => sum + Number(project.actualSpend || 0), 0);
  const snapshotBudgetUtilization = snapshotPortfolioBudget > 0
    ? Math.min(Math.round((snapshotPortfolioSpend / snapshotPortfolioBudget) * 100), 100)
    : 0;
  const snapshotBudgetRemaining = Math.max(snapshotPortfolioBudget - snapshotPortfolioSpend, 0);
  const snapshotBudgetOverage = Math.max(snapshotPortfolioSpend - snapshotPortfolioBudget, 0);
  const snapshotBudgetRemainingText = budgetRemainingLabel(snapshotBudgetOverage, snapshotBudgetRemaining);
  const snapshotPortfolioEarnedValue = snapshotExecutionProjects.reduce((sum, project) => {
    return sum + ((project.overallProgress || 0) / 100) * Number(project.approvedBudget || 0);
  }, 0);
  const snapshotPortfolioCPI: number | null = (snapshotPortfolioSpend > 0 && snapshotPortfolioEarnedValue > 0)
    ? Math.round((snapshotPortfolioEarnedValue / snapshotPortfolioSpend) * 100) / 100
    : null;
  const snapshotPortfolioSPI: number | null = (() => {
    const withTimeline = snapshotExecutionProjects.filter((project) => project.plannedStartDate && project.plannedEndDate);
    if (withTimeline.length === 0) return null;
    const now = Date.now();
    let sum = 0;
    for (const project of withTimeline) {
      const pStart = new Date(project.plannedStartDate!).getTime();
      const pEnd = new Date(project.plannedEndDate!).getTime();
      const dur = pEnd - pStart;
      const elapsed = Math.min(Math.max(now - pStart, 0), dur);
      const plannedPct = dur > 0 ? (elapsed / dur) * 100 : 100;
      const actualPct = project.overallProgress || 0;
      sum += plannedPct > 0 ? actualPct / plannedPct : 1;
    }
    return Math.round((sum / withTimeline.length) * 100) / 100;
  })();
  const financialPhaseData = useMemo(() => {
    const phaseMap = new Map<string, { phase: string; budget: number; spend: number; earned: number; count: number }>();
    snapshotExecutionProjects.forEach((project) => {
      const rawPhase = String(project.currentPhase || 'unassigned').replaceAll('_', ' ').trim();
      const phase = rawPhase.length > 0 ? rawPhase : 'unassigned';
      const budget = Number(project.approvedBudget || 0);
      const spend = Number(project.actualSpend || 0);
      const earned = ((project.overallProgress || 0) / 100) * budget;
      const existing = phaseMap.get(phase) ?? { phase, budget: 0, spend: 0, earned: 0, count: 0 };
      existing.budget += budget;
      existing.spend += spend;
      existing.earned += earned;
      existing.count += 1;
      phaseMap.set(phase, existing);
    });

    return Array.from(phaseMap.values())
      .map((item) => ({
        ...item,
        phase: item.phase.replace(/\b\w/g, (letter) => letter.toUpperCase()),
        variance: item.spend - item.budget,
        burnPct: item.budget > 0 ? Math.round((item.spend / item.budget) * 100) : 0,
      }))
      .sort((left, right) => right.budget - left.budget)
      .slice(0, 6);
  }, [snapshotExecutionProjects]);
  const financialVarianceProjects = useMemo(() => {
    return snapshotExecutionProjects
      .map((project) => {
        const budget = Number(project.approvedBudget || 0);
        const spend = Number(project.actualSpend || 0);
        const variance = spend - budget;
        const utilization = budget > 0 ? Math.round((spend / budget) * 100) : 0;
        return {
          id: String(project.id || project.projectCode || project.projectName || nanoid()),
          name: project.projectCode || project.projectName || 'Project',
          budget,
          spend,
          variance,
          utilization,
        };
      })
      .filter((project) => project.budget > 0 || project.spend > 0)
      .sort((left, right) => Math.abs(right.variance) - Math.abs(left.variance))
      .slice(0, 8);
  }, [snapshotExecutionProjects]);
  const financialEfficiencyPoints = useMemo(() => {
    return snapshotExecutionProjects
      .map((project) => {
        const budget = Number(project.approvedBudget || 0);
        const spend = Number(project.actualSpend || 0);
        const progress = Number(project.overallProgress || 0);
        const earned = (progress / 100) * budget;
        const cpi = spend > 0 ? earned / spend : null;
        return {
          id: String(project.id || project.projectCode || project.projectName || nanoid()),
          name: project.projectCode || project.projectName || 'Project',
          progress,
          utilization: budget > 0 ? Math.round((spend / budget) * 100) : 0,
          budget,
          health: String(project.healthStatus || 'on_track'),
          cpi,
        };
      })
      .filter((project) => project.budget > 0)
      .slice(0, 24);
  }, [snapshotExecutionProjects]);
  const worstVarianceProject = financialVarianceProjects[0] ?? null;
  const approvalLaneMeta = [
    {
      key: 'brain',
      icon: Shield,
      label: 'Brain gates',
      count: pendingBrainApprovals.length,
      accent: 'from-cyan-500 to-emerald-600',
      surface: 'border-cyan-200/70 bg-cyan-50/70 dark:border-cyan-500/20 dark:bg-cyan-500/10',
      chip: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20 dark:text-cyan-300',
      hint: 'Layer 7 Decision Spine approvals',
      sla: 'PMO Director',
    },
    {
      key: 'conversion',
      icon: Send,
      label: t('pmo.office.laneConversion'),
      count: pendingRequests.length,
      accent: 'from-sky-500 to-blue-600',
      surface: 'border-sky-200/70 bg-sky-50/70 dark:border-sky-500/20 dark:bg-sky-500/10',
      chip: 'bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-300',
      hint: 'Demand-to-project intake decisions',
      sla: '24h target',
    },
    {
      key: 'wbs',
      icon: Layers,
      label: t('pmo.office.laneWbs'),
      count: pendingWbsApprovals.length,
      accent: 'from-violet-500 to-fuchsia-600',
      surface: 'border-violet-200/70 bg-violet-50/70 dark:border-violet-500/20 dark:bg-violet-500/10',
      chip: 'bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-300',
      hint: 'Execution baseline and scope lock',
      sla: '48h target',
    },
    {
      key: 'risks',
      icon: ShieldAlert,
      label: 'Risk Register',
      count: pendingRiskApprovals.length,
      accent: 'from-rose-500 to-red-600',
      surface: 'border-rose-200/70 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/10',
      chip: 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300',
      hint: 'Planning risk baseline approval',
      sla: '48h target',
    },
    {
      key: 'gates',
      icon: Target,
      label: t('pmo.office.laneGates'),
      count: pendingGateApprovals.length,
      accent: 'from-amber-500 to-orange-600',
      surface: 'border-amber-200/70 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10',
      chip: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300',
      hint: 'Phase readiness and go / no-go',
      sla: 'Executive priority',
    },
    {
      key: 'change-requests',
      icon: GitPullRequest,
      label: t('pmo.office.laneChangeControl'),
      count: pendingChangeRequests.length,
      accent: 'from-emerald-500 to-teal-600',
      surface: 'border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10',
      chip: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300',
      hint: 'Value protection and controlled change',
      sla: '72h target',
    },
  ] as const;
  const activeApprovalLane = approvalLaneMeta.find((lane) => lane.key === approvalSubTab) ?? approvalLaneMeta[0];
  const activeApprovalLaneShare = Math.min(100, Math.round((activeApprovalLane.count / Math.max(totalPendingApprovals, 1)) * 100));
  const { hasGovernanceOperationalEvidence } = computeEvidenceFlags({
    gateHistory: gateHistory.length,
    pendingGates: pendingGateApprovals.length,
    pendingWbs: pendingWbsApprovals.length,
    changeRequests: changeRequests.length,
    portfolioTotal,
    portfolioActive,
    portfolioCompleted,
    portfolioBudget,
    portfolioSpend,
    approvedDemand: approvedDemandCount,
    conversionTotal,
  });
  const { governanceReadinessScore, valueRealizationScore, portfolioDragIndex, approvalPressureScore } = computeGovernanceScores({
    hasGovernanceEvidence: hasGovernanceOperationalEvidence,
    averageGateReadiness,
    insightHealthScore,
    insightCriticalGaps,
    portfolioHealth,
    conversionSuccessRate,
    portfolioBudget,
    budgetUtilization,
    changeRequestsLength: changeRequests.length,
    implementedChangeRequests: changeRequestTotals.implemented,
    healthBreakdown,
    pendingRequestsLength: pendingRequests.length,
    pendingGateApprovalsLength: pendingGateApprovals.length,
    highImpactChanges,
    totalPendingApprovals,
    insightAlerts,
  });
  const _highAttentionProjects = computeHighAttentionProjects(activeExecutionProjects);
  const executiveDecisionAgenda = buildExecutiveDecisionAgenda({
    pendingGates: pendingGateApprovals.length,
    highImpactChanges,
    pendingRequests: pendingRequests.length,
    pendingWbs: pendingWbsApprovals.length,
  });
  const _approvalHeroMetrics = [
    {
      label: 'Open decisions',
      value: totalPendingApprovals.toLocaleString(),
      detail: 'Across conversions, baselines, gates, and controlled changes.',
      icon: ClipboardList,
      surface: 'border-slate-200/70 bg-white/85 dark:border-slate-700/40 dark:bg-slate-950/60',
      accent: 'text-slate-700 dark:text-slate-200',
    },
    {
      label: 'Escalations',
      value: executiveDecisionAgenda.length.toLocaleString(),
      detail: 'Approval items that need executive attention first.',
      icon: Lightbulb,
      surface: 'border-amber-200/70 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10',
      accent: 'text-amber-700 dark:text-amber-300',
    },
    {
      label: 'Readiness',
      value: `${governanceReadinessScore}%`,
      detail: 'Composite signal for board readiness and control hygiene.',
      icon: Shield,
      surface: 'border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10',
      accent: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      label: 'Pressure',
      value: `${approvalPressureScore}%`,
      detail: 'Queue stress driven by backlog, gates, and change intensity.',
      icon: Flame,
      surface: 'border-rose-200/70 bg-rose-50/80 dark:border-rose-500/20 dark:bg-rose-500/10',
      accent: 'text-rose-700 dark:text-rose-300',
    },
  ];
  const executionMatrixData = activeExecutionProjects.map((project) => {
    const budget = Number(project.approvedBudget || 0);
    const spend = Number(project.actualSpend || 0);
    const burnRate = budget > 0 ? Math.round((spend / budget) * 100) : 0;
    return {
      name: project.projectCode || project.projectName?.slice(0, 12) || '?',
      fullName: project.projectName || project.projectCode || 'Unknown',
      progress: project.overallProgress || 0,
      burnRate: Math.min(burnRate, 150),
      budget,
      health: project.healthStatus || 'on_track',
      phase: project.currentPhase || 'intake',
      risk: project.riskScore || 0,
    };
  });

  // ── Pre-computed dashboard data (extracted to reduce JSX nesting & CC) ──
  const _governanceMetrics = [
    { label: 'Governance Readiness', value: governanceReadinessScore, color: thresholdBg(governanceReadinessScore, 70, 40) },
    { label: 'Value Realization', value: valueRealizationScore, color: thresholdBg(valueRealizationScore, 70, 40) },
    { label: 'Gate Readiness', value: averageGateReadiness, color: thresholdBg(averageGateReadiness, 70, 40) },
    { label: 'Conversion Rate', value: conversionSuccessRate, color: thresholdBg(conversionSuccessRate, 60, 30) },
    { label: 'Approval Pressure', value: approvalPressureScore, color: thresholdBgInverse(approvalPressureScore, 30, 60) },
  ];

  const priorityData = (['critical', 'high', 'medium', 'low'] as const).map(priority => ({
    priority: priority.charAt(0).toUpperCase() + priority.slice(1),
    total: projects.filter(p => (p.priority || 'medium') === priority).length,
    onTrack: projects.filter(p => (p.priority || 'medium') === priority && p.healthStatus === 'on_track').length,
    atRisk: projects.filter(p => (p.priority || 'medium') === priority && (p.healthStatus === 'at_risk' || p.healthStatus === 'critical')).length,
  })).filter(d => d.total > 0);

  const _budgetRemainingText = budgetRemainingLabel(budgetOverage, budgetRemaining);

  // ── Pre-computed data for overview dashboard ──

  const priorityGroups = (['high', 'medium', 'low'] as const).map(prio => {
    const matching = projects.filter(p => (p.priority || 'medium') === prio);
    const totalBudget = matching.reduce((s, p) => s + Number(p.approvedBudget || 0), 0);
    const totalSpend = matching.reduce((s, p) => s + Number(p.actualSpend || 0), 0);
    const spendPct = totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0;
    return {
      priority: prio,
      label: prio.charAt(0).toUpperCase() + prio.slice(1),
      projects: matching,
      count: matching.length,
      totalBudget,
      totalSpend,
      spendPct,
    };
  });

  const DONUT_PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];
  const _donutArc = (entries: { name: string; value: number; color?: string }[], size: number, thickness: number) => {
    const total = entries.reduce((s, e) => s + e.value, 0);
    if (total === 0) return [];
    const cx = size / 2;
    const cy = size / 2;
    const r = (size - thickness) / 2;
    let cumAngle = -90;
    return entries.map((entry, i) => {
      const sweep = (entry.value / total) * 360;
      const gap = entries.length > 1 ? 2 : 0;
      const actualSweep = Math.max(sweep - gap, 0.5);
      const startRad = (cumAngle * Math.PI) / 180;
      const endRad = ((cumAngle + actualSweep) * Math.PI) / 180;
      cumAngle += sweep;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      const large = actualSweep > 180 ? 1 : 0;
      return {
        path: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
        color: entry.color ?? DONUT_PALETTE[i % DONUT_PALETTE.length],
        name: entry.name,
        value: entry.value,
        pct: Math.round((entry.value / total) * 100),
      };
    });
  };

  // ── Advanced Portfolio Intelligence Metrics ──
  const portfolioEarnedValue = projects.reduce((s, p) => s + ((p.overallProgress || 0) / 100) * Number(p.approvedBudget || 0), 0);
  // CPI is only defined when we have actual cost signal AND earned value signal.
  // Defaulting to 1 when there is no spend masks the fact that nothing is being measured.
  const portfolioCPI: number | null = (portfolioSpend > 0 && portfolioEarnedValue > 0)
    ? Math.round((portfolioEarnedValue / portfolioSpend) * 100) / 100
    : null;
  const _portfolioSPI: number | null = (() => {
    const withTimeline = projects.filter(p => p.plannedStartDate && p.plannedEndDate);
    if (withTimeline.length === 0) return null;
    const now = Date.now();
    let sum = 0;
    for (const p of withTimeline) {
      const pStart = new Date(p.plannedStartDate!).getTime();
      const pEnd = new Date(p.plannedEndDate!).getTime();
      const dur = pEnd - pStart;
      const elapsed = Math.min(Math.max(now - pStart, 0), dur);
      const plannedPct = dur > 0 ? (elapsed / dur) * 100 : 100;
      const actualPct = p.overallProgress || 0;
      sum += plannedPct > 0 ? actualPct / plannedPct : 1;
    }
    return Math.round((sum / withTimeline.length) * 100) / 100;
  })();
  const projectsWithRisk = projects.filter(p => p.riskScore != null && Number(p.riskScore) > 0);
  const avgRiskScore = projectsWithRisk.length > 0 ? Math.round(projectsWithRisk.reduce((s, p) => s + Number(p.riskScore), 0) / projectsWithRisk.length) : null;
  const projectsWithCompliance = projects.filter(p => p.complianceScore != null && Number(p.complianceScore) > 0);
  const avgComplianceScore = projectsWithCompliance.length > 0 ? Math.round(projectsWithCompliance.reduce((s, p) => s + Number(p.complianceScore), 0) / projectsWithCompliance.length) : null;
  const projectsWithAlignment = projects.filter(p => p.strategicAlignment != null && Number(p.strategicAlignment) > 0);
  const _avgStrategicAlignment = projectsWithAlignment.length > 0 ? Math.round(projectsWithAlignment.reduce((s, p) => s + Number(p.strategicAlignment), 0) / projectsWithAlignment.length) : null;
  const _totalAllocatedFTE = projects.reduce((s, p) => s + Number(p.allocatedFTE || 0), 0);
  const _riskDistribution = {
    low: projects.filter(p => (p.riskScore || 0) < 30).length,
    medium: projects.filter(p => (p.riskScore || 0) >= 30 && (p.riskScore || 0) < 70).length,
    high: projects.filter(p => (p.riskScore || 0) >= 70).length,
  };
  const onTrackPct = portfolioTotal > 0 ? (healthBreakdown.on_track / portfolioTotal) * 100 : 0;
  // Portfolio health must compose only signals that actually exist; when a signal is null we drop
  // both its contribution and its weight so the result stays a true weighted average.
  const portfolioHealthScore = portfolioTotal === 0 ? 0 : (() => {
    const contribs: Array<{ w: number; v: number }> = [
      { w: 0.30, v: onTrackPct },
    ];
    if (portfolioCPI != null) contribs.push({ w: 0.20, v: Math.min(portfolioCPI * 100, 120) });
    if (hasGovernanceOperationalEvidence) contribs.push({ w: 0.20, v: governanceReadinessScore });
    if (avgRiskScore != null) contribs.push({ w: 0.15, v: 100 - avgRiskScore });
    if (avgComplianceScore != null) contribs.push({ w: 0.15, v: avgComplianceScore });
    const totalWeight = contribs.reduce((s, c) => s + c.w, 0);
    if (totalWeight === 0) return 0;
    const weighted = contribs.reduce((s, c) => s + c.w * c.v, 0);
    return Math.min(100, Math.max(0, Math.round(weighted / totalWeight)));
  })();
  // Phase transition velocity (avg days per project in current phase)
  const phaseVelocityData = (() => {
    const byPhase: Record<string, { count: number; totalDays: number }> = {};
    for (const p of projects) {
      const phase = (p.currentPhase || 'intake').replaceAll('_', ' ');
      const rawDate = p.actualStartDate ?? p.plannedStartDate;
      const start = rawDate ? new Date(rawDate) : null;
      const days = start ? Math.max(1, Math.round((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))) : 0;
      byPhase[phase] ??= { count: 0, totalDays: 0 };
      byPhase[phase].count++;
      byPhase[phase].totalDays += days;
    }
    return Object.entries(byPhase).map(([phase, d]) => ({
      phase: phase.charAt(0).toUpperCase() + phase.slice(1),
      avgDays: d.count > 0 ? Math.round(d.totalDays / d.count) : 0,
      count: d.count,
    })).sort((a, b) => b.count - a.count);
  })();

  // ── Department / Sponsor breakdown ──
  const _sponsorBreakdown = (() => {
    const bySponsor: Record<string, { count: number; budget: number; avgProgress: number; progressSum: number }> = {};
    for (const p of projects) {
      const dept = p.sponsor || p.projectManager || 'Unassigned';
      bySponsor[dept] ??= { count: 0, budget: 0, avgProgress: 0, progressSum: 0 };
      bySponsor[dept].count++;
      bySponsor[dept].budget += Number(p.approvedBudget || 0);
      bySponsor[dept].progressSum += (p.overallProgress || 0);
    }
    return Object.entries(bySponsor)
      .map(([name, d]) => ({ name: name.length > 18 ? name.slice(0, 16) + '…' : name, fullName: name, count: d.count, budget: d.budget, avgProgress: d.count > 0 ? Math.round(d.progressSum / d.count) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  })();
  const _ownerBreakdown = (() => {
    const byOwner: Record<string, { count: number; budget: number }> = {};
    for (const p of projects) {
      const owner = p.projectManager || p.sponsor || 'Unassigned';
      byOwner[owner] ??= { count: 0, budget: 0 };
      byOwner[owner].count++;
      byOwner[owner].budget += Number(p.approvedBudget || 0);
    }
    return Object.entries(byOwner)
      .map(([name, data]) => ({
        name: name.length > 18 ? `${name.slice(0, 16)}…` : name,
        fullName: name,
        count: data.count,
        budget: data.budget,
      }))
      .sort((a, b) => b.budget - a.budget || b.count - a.count)
      .slice(0, 4);
  })();
  const departmentBreakdown = (() => {
    const byDepartment: Record<string, { count: number; budget: number }> = {};
    for (const p of projects) {
      const department = p.department || 'Unassigned';
      byDepartment[department] ??= { count: 0, budget: 0 };
      byDepartment[department].count++;
      byDepartment[department].budget += Number(p.approvedBudget || 0);
    }
    return Object.entries(byDepartment)
      .map(([name, data]) => ({
        name: name.length > 18 ? `${name.slice(0, 16)}…` : name,
        fullName: name,
        count: data.count,
        budget: data.budget,
      }))
      .sort((a, b) => b.budget - a.budget || b.count - a.count)
      .slice(0, 4);
  })();
  const _topRiskItems = projects
    .map((project) => ({
      id: project.id,
      name: project.projectName || project.projectCode || 'Unnamed project',
      score: Number(project.riskScore || 0),
      health: project.healthStatus || 'on_track',
      phase: project.currentPhase || 'intake',
    }))
    .filter((project) => Number.isFinite(project.score) && project.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const hasSignalValue = (value: unknown) => {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return value != null;
  };

  const getDayDelta = (later?: string | null, earlier?: string | null) => {
    if (!later || !earlier) return 0;
    const laterDate = new Date(later);
    const earlierDate = new Date(earlier);
    if (Number.isNaN(laterDate.getTime()) || Number.isNaN(earlierDate.getTime())) return 0;
    return Math.max(0, Math.round((laterDate.getTime() - earlierDate.getTime()) / 86400000));
  };

  const getDaysSince = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Math.max(0, Math.round((Date.now() - date.getTime()) / 86400000));
  };

  const openProjectWorkspace = (projectId?: string | number | null) => {
    if (!projectId) return;
    setLocation(`/project/${String(projectId)}`);
  };

  const queuePmoAction = (title: string, _prompt: string) => {
    setPmoChatOpen(true);
    toast({
      title,
      description: 'Open the PMO advisor to send your query.',
    });
  };

  const pendingGatesByProject = pendingGateApprovals.reduce<Record<string, GateApproval[]>>((acc, gate) => {
    const projectId = gate.project_id;
    if (!projectId) return acc;
    acc[projectId] ??= [];
    acc[projectId].push(gate);
    return acc;
  }, {});
  const pendingWbsByProject = pendingWbsApprovals.reduce<Record<string, WbsApproval[]>>((acc, approval) => {
    const projectId = approval.project_id;
    if (!projectId) return acc;
    acc[projectId] ??= [];
    acc[projectId].push(approval);
    return acc;
  }, {});
  const pendingChangesByProject = pendingChangeRequests.reduce<Record<string, typeof pendingChangeRequests>>((acc, change) => {
    if (!change.projectId) return acc;
    if (!acc[change.projectId]) {
      acc[change.projectId] = [];
    }
    acc[change.projectId]!.push(change);
    return acc;
  }, {} as Record<string, typeof pendingChangeRequests>);

  const riskRadarItems = _highAttentionProjects
    .map((attention) => {
      const sourceProject = activeExecutionProjects.find((project) => String(project.id) === attention.id);
      if (!sourceProject) return null;
      const sourceProjectKey = sourceProject.id != null ? String(sourceProject.id) : "";

      const scheduleSlipDays = getDayDelta(sourceProject.forecastEndDate, sourceProject.plannedEndDate)
        + (pendingChangesByProject[sourceProjectKey] || []).reduce((sum: number, change) => sum + Math.max(0, Number(change.estimatedScheduleImpact || 0)), 0);
      const changeCostExposure = (pendingChangesByProject[sourceProjectKey] || []).reduce((sum: number, change) => sum + Math.max(0, Number(change.estimatedCostImpact || 0)), 0);
      const modeledExposureAed = Math.round(
        changeCostExposure + (Number(sourceProject.approvedBudget || 0) * Math.max(attention.riskScore, 20) * (attention.health === 'critical' ? 0.0014 : 0.0008)),
      );
      const blockedBy = [
        ...(pendingGatesByProject[sourceProjectKey]?.map((gate: GateApproval) => `${asText(gate.gate_name, 'Unnamed')} gate`) || []),
        ...(pendingWbsByProject[sourceProjectKey]?.length ? ['WBS lock'] : []),
        ...(pendingChangesByProject[sourceProjectKey]?.length ? ['change control'] : []),
      ].slice(0, 3);
      const overdueGateCount = (pendingGatesByProject[sourceProjectKey] || []).filter((gate) => {
        if (!gate.planned_date) return false;
        return new Date(gate.planned_date).getTime() < Date.now();
      }).length;
      const highImpactChangeCount = (pendingChangesByProject[sourceProjectKey] || []).filter((change) => {
        const impact = String(change.impact || '').toLowerCase();
        return impact === 'critical' || impact === 'high';
      }).length;
      const ownerMissing = !hasSignalValue(sourceProject.projectManager) && !hasSignalValue(sourceProject.sponsor);
      const level = attention.health === 'critical' || attention.riskScore >= 70
        ? 'Critical'
        : attention.health === 'at_risk' || attention.riskScore >= 45
          ? 'Elevated'
          : 'Watch';

      return {
        ...attention,
        projectId: sourceProject.id,
        department: sourceProject.department || 'Unassigned',
        owner: sourceProject.projectManager || sourceProject.sponsor || 'Unassigned',
        scheduleSlipDays,
        modeledExposureAed,
        blockedBy,
        overdueGateCount,
        highImpactChangeCount,
        ownerMissing,
        level,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  const totalModeledRiskExposure = riskRadarItems.reduce((sum, item) => sum + item.modeledExposureAed, 0);

  const riskHeatmap = activeExecutionProjects.reduce<Record<'low' | 'medium' | 'high', Record<'low' | 'medium' | 'high', number>>>((acc, project) => {
    const riskScore = Number(project.riskScore || 0);
    const spend = Number(project.actualSpend || 0);
    const budget = Number(project.approvedBudget || 0);
    const burnRate = budget > 0 ? (spend / budget) * 100 : 0;
    const likelihood = riskScore >= 70 || burnRate > 100 || project.healthStatus === 'critical'
      ? 'high'
      : riskScore >= 40 || burnRate >= 85 || project.healthStatus === 'at_risk'
        ? 'medium'
        : 'low';
    const impact = riskScore >= 75 || budget >= 50000000 || getDayDelta(project.forecastEndDate, project.plannedEndDate) > 45
      ? 'high'
      : riskScore >= 40 || budget >= 15000000 || getDayDelta(project.forecastEndDate, project.plannedEndDate) > 14
        ? 'medium'
        : 'low';
    acc[impact][likelihood] += 1;
    return acc;
  }, {
    low: { low: 0, medium: 0, high: 0 },
    medium: { low: 0, medium: 0, high: 0 },
    high: { low: 0, medium: 0, high: 0 },
  });

  const overdueGateApprovals = pendingGateApprovals.filter((gate) => gate.planned_date && new Date(gate.planned_date).getTime() < Date.now()).length;

  const gateLifecycleStages = [
    { label: 'Initiation', phases: ['intake', 'initiation'] },
    { label: 'Planning', phases: ['planning'] },
    { label: 'Execution', phases: ['execution'] },
    { label: 'Closure', phases: ['closure', 'completed'] },
  ].map((stage) => {
    const count = activeExecutionProjects.filter((project) => stage.phases.includes(String(project.currentPhase || '').toLowerCase())).length;
    return {
      ...stage,
      count,
      share: activeExecutionProjects.length > 0 ? Math.round((count / activeExecutionProjects.length) * 100) : 0,
    };
  });

  const forecastOutlook = (() => {
    const slippedProjects = activeExecutionProjects
      .map((project) => ({
        id: project.id,
        name: project.projectName || project.projectCode || 'Project',
        slipDays: getDayDelta(project.forecastEndDate, project.plannedEndDate),
      }))
      .filter((project) => project.slipDays > 0)
      .sort((left, right) => right.slipDays - left.slipDays);
    const totalSlipDays = slippedProjects.reduce((sum, project) => sum + project.slipDays, 0);
    const estimateAtCompletion = portfolioEarnedValue > 0
      ? Math.round(portfolioSpend + Math.max(0, portfolioBudget - portfolioEarnedValue))
      : portfolioBudget;
    const projectedOverrun = Math.max(0, estimateAtCompletion - portfolioBudget);
    const riskPressure30 = Math.min(100, Math.round((riskRadarItems.length * 14) + (overdueGateApprovals * 9) + (highImpactChanges * 6)));
    return {
      slippedProjects,
      totalSlipDays,
      estimateAtCompletion,
      projectedOverrun,
      riskPressure30,
    };
  })();

  const prioritizationWatch = activeExecutionProjects
    .map((project) => {
      const alignment = Number(project.strategicAlignment || 0);
      const riskScore = Number(project.riskScore || 0);
      const spend = Number(project.actualSpend || 0);
      const budget = Number(project.approvedBudget || 0);
      const burnRate = budget > 0 ? Math.round((spend / budget) * 100) : 0;
      const decision = project.healthStatus === 'critical' || (alignment < 45 && riskScore >= 60) || burnRate > 115
        ? 'Stop'
        : project.healthStatus === 'at_risk' || alignment < 65 || riskScore >= 40 || burnRate >= 90
          ? 'Review'
          : 'Continue';
      const urgencyScore = (decision === 'Stop' ? 100 : decision === 'Review' ? 65 : 35) + riskScore + Math.max(0, burnRate - 100);
      return {
        id: project.id,
        name: project.projectName || project.projectCode || 'Project',
        decision,
        alignment,
        riskScore,
        burnRate,
        urgencyScore,
      };
    })
    .sort((left, right) => right.urgencyScore - left.urgencyScore);

  const prioritizationSummary = prioritizationWatch.reduce((acc, project) => {
    if (project.decision === 'Continue') acc.continue += 1;
    else if (project.decision === 'Review') acc.review += 1;
    else acc.stop += 1;
    return acc;
  }, { continue: 0, review: 0, stop: 0 });

  const dataConfidenceRows = activeExecutionProjects.map((project) => {
    const completenessChecks = [
      hasSignalValue(project.projectManager),
      hasSignalValue(project.department),
      hasSignalValue(project.approvedBudget),
      hasSignalValue(project.plannedEndDate),
      hasSignalValue(project.forecastEndDate || project.plannedEndDate),
      hasSignalValue(project.healthStatus),
      hasSignalValue(project.actualSpend) || hasSignalValue(project.overallProgress),
      hasSignalValue(project.riskFactors) || Number(project.riskScore || 0) > 0,
    ];
    const completeness = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);
    const reportingCompliance = Math.round(([
      hasSignalValue(project.overallProgress),
      hasSignalValue(project.actualSpend),
      hasSignalValue(project.healthStatus),
    ].filter(Boolean).length / 3) * 100);
    const lastUpdated = ((project as Record<string, unknown>).updatedAt as string | null | undefined) || project.createdAt || null;
    return {
      id: project.id,
      name: project.projectName || project.projectCode || 'Project',
      owner: project.projectManager || project.sponsor || 'Unassigned',
      ownerMissing: !hasSignalValue(project.projectManager) && !hasSignalValue(project.sponsor),
      completeness,
      reportingCompliance,
      stalenessDays: getDaysSince(lastUpdated),
      lastUpdated,
    };
  });

  const _dataConfidenceScore = dataConfidenceRows.length > 0
    ? Math.round(dataConfidenceRows.reduce((sum, row) => sum + row.completeness, 0) / dataConfidenceRows.length)
    : 0;
  const _reportingComplianceScore = dataConfidenceRows.length > 0
    ? Math.round(dataConfidenceRows.reduce((sum, row) => sum + row.reportingCompliance, 0) / dataConfidenceRows.length)
    : 0;
  const ownerGapProjects = dataConfidenceRows.filter((row) => row.ownerMissing).slice(0, 4);
  const _staleProjects = dataConfidenceRows.filter((row) => (row.stalenessDays ?? 0) > 14).sort((left, right) => (right.stalenessDays ?? 0) - (left.stalenessDays ?? 0)).slice(0, 4);

  const crossProjectImpactSignals = Object.values(activeExecutionProjects.reduce<Record<string, { department: string; count: number; atRisk: number; blocked: number; exposure: number }>>((acc, project) => {
    const department = project.department || 'Unassigned';
    acc[department] ??= { department, count: 0, atRisk: 0, blocked: 0, exposure: 0 };
    acc[department].count += 1;
    if (project.healthStatus === 'at_risk' || project.healthStatus === 'critical') acc[department].atRisk += 1;
    const projectKey = project.id != null ? String(project.id) : "";
    if ((pendingGatesByProject[projectKey]?.length || 0) + (pendingWbsByProject[projectKey]?.length || 0) + (pendingChangesByProject[projectKey]?.length || 0) > 0) acc[department].blocked += 1;
    acc[department].exposure += Number(project.approvedBudget || 0);
    return acc;
  }, {}))
    .filter((department) => department.count > 1 && (department.atRisk > 0 || department.blocked > 0))
    .sort((left, right) => (right.atRisk + right.blocked) - (left.atRisk + left.blocked) || right.exposure - left.exposure)
    .slice(0, 4);

  const _decisionQueueItems = [
    ...pendingGateApprovals.slice(0, 2).map((gate) => ({ kind: 'gate' as const, urgency: gate.planned_date && new Date(gate.planned_date).getTime() < Date.now() ? 100 : 80, payload: gate })),
    ...pendingChangeRequests.slice(0, 2).map((change) => ({ kind: 'change' as const, urgency: change.impact === 'critical' ? 95 : 74, payload: change })),
    ...pendingWbsApprovals.slice(0, 1).map((approval) => ({ kind: 'wbs' as const, urgency: 72, payload: approval })),
  ]
    .sort((left, right) => right.urgency - left.urgency)
    .slice(0, 4);

  const gatePipelineDepartments = departmentBreakdown.slice(0, 4);
  const _gatePipelineDepartmentTotal = gatePipelineDepartments.reduce((sum, department) => sum + department.count, 0);

  const highRiskProjectCount = riskRadarItems.filter((item) => item.level === 'Critical' || item.level === 'Elevated').length;

  const executiveKpis = [
    {
      label: 'Governed Portfolio',
      value: `${portfolioTotal}`,
      hint: 'Total projects under PMO governance',
      tone: 'border-slate-200/70 bg-white/80 dark:border-white/10 dark:bg-white/5',
      iconColor: 'text-slate-500 dark:text-slate-400',
      icon: Layers,
    },
    {
      label: 'Delivery at Risk',
      value: `${highRiskProjectCount}`,
      hint: 'Critical or elevated — CEO attention required',
      tone: 'border-rose-200/70 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/10',
      iconColor: 'text-rose-500',
      icon: AlertTriangle,
    },
    {
      label: 'Portfolio Health',
      value: `${portfolioHealthScore}%`,
      hint: 'Composite delivery & governance score',
      tone: 'border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10',
      iconColor: 'text-emerald-500',
      icon: TrendingUp,
    },
    {
      label: 'Budget Burn',
      value: `${budgetUtilization}%`,
      hint: 'Spend vs approved funding envelope',
      tone: 'border-amber-200/70 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10',
      iconColor: 'text-amber-500',
      icon: DollarSign,
    },
    {
      label: 'Risk Exposure',
      value: `${(totalModeledRiskExposure / 1000000).toFixed(1)}M AED`,
      hint: 'Modeled financial exposure at risk',
      tone: 'border-rose-200/70 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/10',
      iconColor: 'text-rose-500',
      icon: Shield,
    },
    {
      label: 'Schedule Drag',
      value: `${forecastOutlook.totalSlipDays}d`,
      hint: 'Forecast slip days vs baseline',
      tone: 'border-cyan-200/70 bg-cyan-50/70 dark:border-cyan-500/20 dark:bg-cyan-500/10',
      iconColor: 'text-cyan-500',
      icon: Clock,
    },
    {
      label: 'Overdue Gates',
      value: `${overdueGateApprovals}`,
      hint: 'Governance decisions past review date',
      tone: 'border-violet-200/70 bg-violet-50/70 dark:border-violet-500/20 dark:bg-violet-500/10',
      iconColor: 'text-violet-500',
      icon: Hourglass,
    },
  ];

  const topRiskRadarItem = riskRadarItems[0] ?? null;

  type ExecutiveFeedCoreItem = {
    tone: 'rose' | 'amber' | 'emerald' | 'sky' | 'violet';
    icon: LucideIcon;
    kicker: string;
    title: string;
    description: string;
    actionLabel: string;
    onAction: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
    /** Stable unique key — prevents React key collisions for items with identical titles */
    feedKey?: string;
  };

  const topOverdueGate = pendingGateApprovals
    .filter((gate) => gate.planned_date && new Date(gate.planned_date).getTime() < Date.now())
    .sort((left, right) => new Date(left.planned_date || 0).getTime() - new Date(right.planned_date || 0).getTime())[0] ?? null;
  const highestImpactChange = pendingChangeRequests
    .sort((left, right) => Number(right.estimatedCostImpact || 0) - Number(left.estimatedCostImpact || 0))[0] ?? null;
  const topOwnerGapProject = ownerGapProjects[0] ?? null;
  const queueSummaryText = `Brain ${pendingBrainApprovals.length} • Demands ${pendingRequests.length} • Gates ${pendingGateApprovals.length} • Change ${pendingChangeRequests.length} • WBS ${pendingWbsApprovals.length}.`;
  const decisionExposureAed = Math.max(totalModeledRiskExposure, forecastOutlook.projectedOverrun, snapshotBudgetOverage, 0);

  const executiveAlerts = ([
    (topRiskRadarItem && highRiskProjectCount > 0)
      ? {
          tone: 'rose',
          icon: AlertTriangle,
          kicker: 'Delivery risk',
          title: `${highRiskProjectCount} high-risk projects require executive intervention`,
          description: `${topRiskRadarItem.name} currently leads risk exposure at ${(topRiskRadarItem.modeledExposureAed / 1000000).toFixed(1)}M AED with active delivery pressure.`,
          actionLabel: 'Open highest risk',
          onAction: () => openProjectWorkspace(topRiskRadarItem.projectId),
          feedKey: 'alert:delivery-risk',
        }
      : null,
    overdueGateApprovals > 0
      ? {
          tone: 'amber',
          icon: Hourglass,
          kicker: 'Governance SLA',
          title: `${overdueGateApprovals} overdue gate approvals are blocking progression`,
          description: topOverdueGate
            ? `${topOverdueGate.project_name || 'A project'} (${topOverdueGate.gate_name || 'gate'}) is already past planned decision date.`
            : 'One or more gate decisions are past SLA and delaying lifecycle movement.',
          actionLabel: 'Open gate queue',
          onAction: () => {
            setActiveTab('approvals');
            setApprovalSubTab('gates');
          },
          feedKey: 'alert:overdue-gates',
        }
      : null,
    totalPendingApprovals > 0
      ? {
          tone: approvalPressureScore >= 70 ? 'rose' : 'violet',
          icon: Layers,
          kicker: 'Decision backlog',
          title: `${totalPendingApprovals} approvals are waiting in the PMO queue`,
          description: queueSummaryText,
          actionLabel: 'Review full queue',
          onAction: () => {
            setActiveTab('approvals');
            setApprovalSubTab(pendingBrainApprovals.length > 0 ? 'brain' : 'gates');
          },
          feedKey: 'alert:decision-backlog',
        }
      : null,
    (snapshotBudgetOverage > 0 || snapshotBudgetUtilization > 95)
      ? {
          tone: snapshotBudgetOverage > 0 ? 'rose' : 'amber',
          icon: DollarSign,
          kicker: 'Financial control',
          title: snapshotBudgetOverage > 0
            ? `Portfolio spend is ${(snapshotBudgetOverage / 1000000).toFixed(1)}M AED over approved baseline`
            : `Portfolio burn reached ${snapshotBudgetUtilization}% of approved baseline`,
          description: 'Budget variance requires immediate PMO containment and funding-governance actions.',
          actionLabel: 'Review financials',
          onAction: () => setActiveTab('overview'),
          feedKey: 'alert:financial-control',
        }
      : null,
    ownerGapProjects.length > 0
      ? {
          tone: 'sky',
          icon: Users,
          kicker: 'Ownership integrity',
          title: `${ownerGapProjects.length} projects are missing accountable ownership`,
          description: 'PM or sponsor attribution is incomplete, reducing escalation and delivery accountability.',
          actionLabel: 'Open owner gap',
          onAction: () => topOwnerGapProject && openProjectWorkspace(topOwnerGapProject.id),
          feedKey: 'alert:ownership-integrity',
        }
      : null,
    highestImpactChange && (highestImpactChange.impact === 'critical' || highestImpactChange.impact === 'high')
      ? {
          tone: 'amber',
          icon: GitPullRequest,
          kicker: 'Scope economics',
          title: `High-impact change pending on ${highestImpactChange.projectName || 'portfolio project'}`,
          description: `${(Number(highestImpactChange.estimatedCostImpact || 0) / 1000000).toFixed(1)}M AED potential impact requires board-level disposition.`,
          actionLabel: 'Review change',
          onAction: () => {
            setActiveTab('approvals');
            setApprovalSubTab('change-requests');
            setSelectedChangeRequest(highestImpactChange);
            setCrDetailSheetOpen(true);
          },
          feedKey: 'alert:scope-economics',
        }
      : null,
    (highRiskProjectCount === 0 && overdueGateApprovals === 0 && totalPendingApprovals === 0 && snapshotBudgetOverage <= 0)
      ? {
          tone: 'emerald',
          icon: CheckCircle2,
          kicker: 'Control posture',
          title: 'Portfolio controls are currently stable',
          description: 'No critical risk concentration, no overdue gates, and no approval backlog requiring urgent escalation.',
          actionLabel: 'Capture status brief',
          onAction: () => queuePmoAction('Portfolio control posture brief', 'Prepare an executive status brief summarizing current control posture, queue status, and near-term watch items.'),
          feedKey: 'alert:control-posture',
        }
      : null,
  ] as Array<ExecutiveFeedCoreItem | null>).filter((item): item is ExecutiveFeedCoreItem => item !== null);

  const executiveDecisionStrip = ([
    (decisionExposureAed > 0 && topRiskRadarItem)
      ? {
          tone: 'amber' as const,
          icon: Shield,
          kicker: 'Decision brief',
          title: `Mitigation package required for ${(decisionExposureAed / 1000000).toFixed(1)}M AED exposure`,
          description: `${topRiskRadarItem.name} anchors the current exposure profile and needs a formal decision package for mitigation ownership, budget, and timeline control.`,
          actionLabel: 'Draft package',
          onAction: () => queuePmoAction('Mitigation package drafted', `Draft an executive mitigation package covering ${(decisionExposureAed / 1000000).toFixed(1)}M AED exposure, required approvals, owners, and next governance decisions.`),
          feedKey: 'decision:mitigation-package',
        }
      : null,
    totalPendingApprovals > 0
      ? {
          tone: 'violet' as const,
          icon: Sparkles,
          kicker: 'Decision brief',
          title: 'Board-ready queue brief can be generated now',
          description: `Current queue pressure is ${approvalPressureScore}%. Generate a structured decision brief with priority order and recommended dispositions.`,
          actionLabel: 'Generate brief',
          onAction: () => queuePmoAction('Queue decision brief drafted', `Prepare a board-ready queue brief for ${totalPendingApprovals} pending approvals with recommended priority, rationale, and expected delivery impact.`),
          feedKey: 'decision:queue-brief',
        }
      : null,
  ] as Array<ExecutiveFeedCoreItem | null>).filter((item): item is ExecutiveFeedCoreItem => item !== null);

  type ExecutiveFeedItem = ExecutiveFeedCoreItem & { source: 'Alert' | 'Decision'; priority: number };
  const tonePriority = (tone: ExecutiveFeedCoreItem['tone']): number => {
    if (tone === 'rose') return 100;
    if (tone === 'amber') return 80;
    if (tone === 'violet') return 70;
    if (tone === 'sky') return 60;
    return 50;
  };
  const unifiedExecutiveFeed: ExecutiveFeedItem[] = [
    ...executiveAlerts.map((item) => ({
      ...item,
      source: 'Alert' as const,
      priority: tonePriority(item.tone),
    })),
    ...executiveDecisionStrip.map((item) => ({
      ...item,
      source: 'Decision' as const,
      priority: tonePriority(item.tone) + 5,
    })),
  ]
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 10);

  const _autoInsights = [
    overdueGateApprovals > 0
      ? `Governance drag is concentrated in ${overdueGateApprovals} overdue gate approvals, which is now the clearest barrier to clean phase progression.`
      : null,
    forecastOutlook.totalSlipDays > 0
      ? `Schedule exposure is projected at ${forecastOutlook.totalSlipDays} slip days across ${forecastOutlook.slippedProjects.length} projects, with forecast drift now visible above baseline.`
      : null,
    forecastOutlook.projectedOverrun > 0
      ? `Estimated completion cost is ${(forecastOutlook.estimateAtCompletion / 1000000).toFixed(1)}M AED, which is ${(forecastOutlook.projectedOverrun / 1000000).toFixed(1)}M above the current budget baseline.`
      : null,
    ownerGapProjects.length > 0
      ? `${ownerGapProjects.length} projects still lack a named PM or sponsor, so escalation and recovery ownership are not enforceable.`
      : null,
    prioritizationSummary.stop > 0
      ? `${prioritizationSummary.stop} projects are now in stop / reset territory based on risk, burn, and strategic alignment signals.`
      : null,
  ].filter(Boolean) as string[];

  const selectedRequestDialogData = selectedRequest
    ? {
        id: selectedRequest.id,
        projectName: selectedRequest.projectName || selectedRequest.title || 'Project',
        projectDescription: selectedRequest.projectDescription ?? selectedRequest.description ?? null,
        priority: selectedRequest.priority || 'medium',
        proposedBudget: selectedRequest.proposedBudget ?? null,
      }
    : null;

  const selectedRequestDetails: {
    id: string;
    projectName: string;
    projectDescription: string | null;
    priority: string;
    status: 'pending' | 'under_review' | 'approved' | 'rejected';
    proposedBudget: string | null;
    proposedStartDate: string | null;
    proposedEndDate: string | null;
    requestedByName: string | null;
    createdAt: string;
    conversionData: Record<string, string | string[] | number | boolean | undefined>;
  } | null = selectedRequest
    ? {
        id: selectedRequest.id,
        projectName: selectedRequest.projectName || selectedRequest.title || 'Project',
        projectDescription: selectedRequest.projectDescription ?? selectedRequest.description ?? null,
        priority: selectedRequest.priority || 'medium',
        status: normalizeConversionRequestStatus(selectedRequest.status),
        proposedBudget: selectedRequest.proposedBudget ?? null,
        proposedStartDate: selectedRequest.proposedStartDate ?? null,
        proposedEndDate: selectedRequest.proposedEndDate ?? null,
        requestedByName: selectedRequest.requestedByName ?? null,
        createdAt: selectedRequest.createdAt || selectedRequest.submittedAt || new Date().toISOString(),
        conversionData: selectedRequest.conversionData ?? {},
      }
    : null;

  const selectedWbsApprovalDialogData = selectedWbsApproval
    ? {
        id: selectedWbsApproval.id,
        project_name: selectedWbsApproval.project_name || selectedWbsApproval.projectName || 'Project',
        version: Number(selectedWbsApproval.version || 1),
        task_snapshot: Array.isArray(selectedWbsApproval.task_snapshot) ? selectedWbsApproval.task_snapshot : null,
      }
    : null;

  const selectedGateApprovalDialogData = selectedGateApproval
    ? {
        id: selectedGateApproval.id,
        project_name: selectedGateApproval.project_name || selectedGateApproval.projectName || 'Project',
        gate_type: selectedGateApproval.gate_type || 'phase',
        department: selectedGateApproval.department ?? null,
      }
    : null;

  // ── Gantt timeline data ──
  const ganttData = (() => {
    const resolveStart = (p: typeof projects[0]) => p.plannedStartDate || p.actualStartDate || (p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : null);
    const resolveEnd = (p: typeof projects[0], fallbackStart: string) => {
      if (p.plannedEndDate) return p.plannedEndDate;
      if (p.forecastEndDate) return p.forecastEndDate;
      const d = new Date(fallbackStart); d.setMonth(d.getMonth() + 6);
      return d.toISOString().slice(0, 10);
    };
    const withDates = snapshotExecutionProjects.filter(p => resolveStart(p));
    if (withDates.length === 0) return { projects: [] as { projectId: string; name: string; start: Date; end: Date; forecast: Date | null; progress: number; health: string; phase: string; priority: string }[], minDate: new Date(), maxDate: new Date(), totalDays: 1 };
    const ganttProjects = withDates
      .map(p => {
        const s = resolveStart(p)!;
        const e = resolveEnd(p, s);
        return { projectId: p.id, name: p.projectName?.slice(0, 22) || p.projectCode || '?', start: new Date(s), end: new Date(e), forecast: p.forecastEndDate ? new Date(p.forecastEndDate) : null, progress: p.overallProgress || 0, health: p.healthStatus || 'on_track', phase: (p.currentPhase || 'intake').replaceAll('_', ' '), priority: p.priority || 'medium' };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 12);
    const allDates = ganttProjects.flatMap(p => p.forecast ? [p.start, p.end, p.forecast] : [p.start, p.end]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    const totalDays = Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / 86400000));
    return { projects: ganttProjects, minDate, maxDate, totalDays };
  })();

  const renderBudgetProjectBars = () =>
    snapshotExecutionProjects
      .filter(p => Number(p.approvedBudget || 0) > 0)
      .sort((a, b) => Number(b.approvedBudget || 0) - Number(a.approvedBudget || 0))
      .slice(0, 6)
      .map(project => {
        const pBudget = Number(project.approvedBudget || 0);
        const pSpend = Number(project.actualSpend || 0);
        const pUtil = pBudget > 0 ? Math.min(Math.round((pSpend / pBudget) * 100), 120) : 0;
        return (
          <div key={project.id}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[60%]">{project.projectName?.slice(0, 22) || project.projectCode || '—'}</span>
              <span className={`text-[10px] font-semibold ${utilThresholdText(pUtil)}`}>{pUtil}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className={`h-1.5 rounded-full transition-all ${utilThresholdBg(pUtil)}`} style={{ width: `${Math.min(pUtil, 100)}%` }} />
            </div>
          </div>
        );
      });

  const renderProjectTableRow = (project: typeof activeExecutionProjects[number]) => {
    const pProgress = project.overallProgress || 0;
    const pHealth = project.healthStatus || 'on_track';
    const pRisk = project.riskScore != null ? Number(project.riskScore) : null;
    const pBudget = Number(project.approvedBudget || 0);
    const pSpend = Number(project.actualSpend || 0);
    const burnPct = pBudget > 0 ? Math.round((pSpend / pBudget) * 100) : 0;
    // Derive risk indicator from pipeline complexityRisk when project has no riskScore
    const linkedPipeline = pRisk == null
      ? pipelineItems.find(pi => pi.hasPortfolioProject && pi.suggestedProjectName === project.projectName)
      : null;
    const derivedRisk = linkedPipeline ? Number(linkedPipeline.complexityRisk || 0) : null;
    const displayRisk = pRisk ?? derivedRisk;
    return (
      <TableRow key={project.id} className="hover:bg-white/60 dark:hover:bg-white/5 transition-colors">
        <TableCell className="pl-4">
          <div>
            <p className="text-xs font-medium text-foreground truncate max-w-[200px]">{project.projectName || '—'}</p>
            <p className="text-[10px] text-muted-foreground">{project.projectCode || '—'}</p>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-[10px] capitalize">{(project.currentPhase || '—').replaceAll('_', ' ')}</Badge>
        </TableCell>
        <TableCell>
          <Badge className={`text-[10px] capitalize ${priorityBadgeClass(project.priority || 'medium')}`}>{project.priority || 'medium'}</Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${healthBg(pHealth)}`} />
            <span className="text-[11px] capitalize text-muted-foreground">{pHealth.replaceAll('_', ' ')}</span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden min-w-[60px]">
              <div className={`h-1.5 rounded-full transition-all ${progressBg(pProgress)}`} style={{ width: `${pProgress}%` }} />
            </div>
            <span className="text-[10px] font-semibold text-foreground w-7 text-right">{pProgress}%</span>
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div>
            <span className="text-xs font-medium text-foreground">
              {pBudget > 0 ? `${(pBudget / 1000000).toFixed(1)}M` : '—'}
            </span>
            {pBudget > 0 && <p className="text-[9px] text-muted-foreground">{burnPct}% spent</p>}
          </div>
        </TableCell>
        <TableCell className="text-right pr-4">
          {displayRisk != null && displayRisk > 0 ? (
            <Badge variant={badgeVariantByThreshold(displayRisk, 70, 40)} className="text-[10px]">
              {displayRisk}
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">Not Assessed</span>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const renderProjectCard = (project: typeof activeExecutionProjects[number]) => {
    const pProgress = project.overallProgress || 0;
    const pBudget = Number(project.approvedBudget || 0);
    const pSpend = Number(project.actualSpend || 0);
    const pRisk = project.riskScore != null ? Number(project.riskScore) : null;
    const linkedPipelineCard = pRisk == null
      ? pipelineItems.find(pi => pi.hasPortfolioProject && pi.suggestedProjectName === project.projectName)
      : null;
    const derivedRiskCard = linkedPipelineCard ? Number(linkedPipelineCard.complexityRisk || 0) : null;
    const displayRiskCard = pRisk ?? derivedRiskCard;
    let riskLabel = 'Not Assessed';
    if (displayRiskCard != null && displayRiskCard > 0) {
      if (displayRiskCard >= 70) riskLabel = 'High';
      else if (displayRiskCard >= 40) riskLabel = 'Medium';
      else riskLabel = 'Low';
    }
    const circumference = 2 * Math.PI * 26;
    const strokeOffset = circumference - (pProgress / 100) * circumference;
    let donutStroke = '#f59e0b';
    if (pProgress >= 70) donutStroke = '#10b981';
    else if (pProgress >= 40) donutStroke = '#3b82f6';
    let riskColorClass = 'text-muted-foreground';
    if (displayRiskCard != null && displayRiskCard >= 70) riskColorClass = 'text-red-600';
    else if (displayRiskCard != null && displayRiskCard >= 40) riskColorClass = 'text-amber-600';
    else if (displayRiskCard != null && displayRiskCard > 0) riskColorClass = 'text-emerald-600';
    const budgetLabel = pBudget > 0 ? `$${(pBudget / 1000).toFixed(0)}K` : '—';
    const spendLabel = pSpend > 0 ? `$${(pSpend / 1000).toFixed(0)}K` : '—';
    return (
      <div key={project.id} className="group relative flex items-center gap-3.5 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-gray-100 dark:border-white/10 p-3 shadow-sm hover:shadow-md hover:bg-white/90 dark:hover:bg-white/10 transition-all duration-300">
        <div className="absolute top-0 left-0 h-full w-1 rounded-l-xl bg-gradient-to-b from-blue-400 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex flex-col items-center">
          <div className="relative">
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="26" fill="none" stroke="#e5e7eb" strokeWidth="8" className="dark:stroke-white/10" />
              <circle
                cx="36"
                cy="36"
                r="26"
                fill="none"
                stroke={donutStroke}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                transform="rotate(-90 36 36)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-foreground">{pProgress}%</span>
            </div>
          </div>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Progress</p>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{project.projectName}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{project.department || 'Unassigned department'}</p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-semibold ${riskColorClass}`}>{riskLabel}</p>
              <p className="text-[10px] text-muted-foreground">Risk posture</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-slate-200/70 bg-slate-50/80 px-2.5 py-2 dark:border-white/10 dark:bg-slate-950/30">
              <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Budget</p>
              <p className="mt-1 font-semibold text-foreground">{budgetLabel}</p>
            </div>
            <div className="rounded-lg border border-slate-200/70 bg-slate-50/80 px-2.5 py-2 dark:border-white/10 dark:bg-slate-950/30">
              <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Spend</p>
              <p className="mt-1 font-semibold text-foreground">{spendLabel}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ───────────────────────────────────────────────────────────────
     Extracted Gantt Timeline — professional design, also lowers
     renderOverviewTab cognitive complexity
     ─────────────────────────────────────────────────────────────── */
  const renderGanttTimeline = () => {
    const forecastCount = ganttData.projects.filter((project) => project.forecast && project.forecast.getTime() > project.end.getTime()).length;
    const timelineHeader = (
      <div className="flex flex-col gap-1.5 border-b border-slate-200/70 pb-2 dark:border-white/10">
        <div className="flex flex-col gap-1.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">
              <Calendar className="h-3 w-3" />
            </div>
            <div>
              <h4 className="text-[11px] font-semibold text-foreground leading-none">Projects Snapshot</h4>
              <p className="mt-0.5 text-[8px] uppercase tracking-[0.1em] text-muted-foreground">Delivery pulse, forecast variance and execution posture</p>
            </div>
          </div>
          <div className="flex flex-col gap-1 xl:min-w-[248px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[7px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Segment / Sector</span>
              <Select value={projectsSnapshotSegment} onValueChange={setProjectsSnapshotSegment}>
                <SelectTrigger className="h-5 w-[150px] rounded-md border-slate-200/70 bg-white/80 px-1.5 text-[8px] dark:border-white/10 dark:bg-slate-950/40">
                  <SelectValue placeholder="All segments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All segments</SelectItem>
                  {projectsSnapshotSegments.map((segment) => (
                    <SelectItem key={segment} value={segment}>{segment}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div className="rounded-md border border-slate-200/70 bg-slate-50/80 px-1.5 py-1 dark:border-white/10 dark:bg-slate-950/30">
                <p className="text-[6.5px] uppercase tracking-[0.1em] text-muted-foreground">Active Lanes</p>
                <p className="mt-0.5 text-[11px] font-bold text-foreground">{ganttData.projects.length}</p>
              </div>
              <div className="rounded-md border border-blue-200/70 bg-blue-50/80 px-1.5 py-1 dark:border-blue-500/20 dark:bg-blue-500/10">
                <p className="text-[6.5px] uppercase tracking-[0.1em] text-muted-foreground">Forecast Drift</p>
                <p className="mt-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-300">{forecastCount}</p>
              </div>
              <div className="rounded-md border border-emerald-200/70 bg-emerald-50/80 px-1.5 py-1 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <p className="text-[6.5px] uppercase tracking-[0.1em] text-muted-foreground">On Track</p>
                <p className="mt-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">{ganttData.projects.filter((project) => project.health === 'on_track').length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[7px] text-muted-foreground">
          <span className="flex items-center gap-1 rounded-full border border-slate-200/70 bg-slate-50/80 px-1.5 py-0.5 dark:border-white/10 dark:bg-slate-950/30"><span className="inline-block h-1 w-2.5 rounded-full bg-blue-400/60" />Planned</span>
          <span className="flex items-center gap-1 rounded-full border border-slate-200/70 bg-slate-50/80 px-1.5 py-0.5 dark:border-white/10 dark:bg-slate-950/30"><span className="inline-block h-1 w-2.5 rounded-full bg-amber-400" />Forecast</span>
          <span className="flex items-center gap-1 rounded-full border border-slate-200/70 bg-slate-50/80 px-1.5 py-0.5 dark:border-white/10 dark:bg-slate-950/30"><span className="inline-block h-2.5 w-1 border-l-2 border-red-400 border-dashed" />Today</span>
        </div>
      </div>
    );

    if (ganttData.projects.length === 0) {
      return (
        <div className="relative h-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 min-h-[20rem] shadow-[0_10px_30px_-24px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/[0.03]">
          {timelineHeader}
          <div className="flex min-h-[13rem] flex-col items-center justify-center py-6 text-sm text-muted-foreground">
            <Calendar className="h-8 w-8 mb-2 text-muted-foreground/40" />
            No schedule data available
          </div>
        </div>
      );
    }

    const minT = ganttData.minDate.getTime();
    const tRange = ganttData.totalDays;
    const todayPct = Math.min(100, Math.max(0, (Date.now() - minT) / (tRange * 86400000) * 100));
    const months: { label: string; pct: number }[] = [];
    const cursor = new Date(ganttData.minDate.getFullYear(), ganttData.minDate.getMonth(), 1);
    while (cursor <= ganttData.maxDate) {
      const pct = Math.max(0, (cursor.getTime() - minT) / (tRange * 86400000) * 100);
      if (pct <= 100) months.push({ label: cursor.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), pct });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    let monthStep = 1;
    if (months.length > 12) monthStep = 3;
    else if (months.length > 6) monthStep = 2;
    const visibleMonths = months.filter((_, i) => i % monthStep === 0);

    return (
      <div className="relative flex h-full min-h-[22rem] max-h-[34rem] flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/[0.03]">
        {timelineHeader}
        {/* Month header row — aligned to bar area */}
        <div className="mt-4 flex items-end mb-1">
          <div className="w-[138px] flex-shrink-0" />
          <div className="flex-1 relative h-6 border-b border-gray-200/60 dark:border-white/10">
            {visibleMonths.map((m) => (
              <span key={m.label} className="absolute bottom-1 text-[8px] font-semibold text-muted-foreground/70 uppercase tracking-wider whitespace-nowrap" style={{ left: `${m.pct}%`, transform: 'translateX(-50%)' }}>{m.label}</span>
            ))}
          </div>
        </div>
        <div className="projects-snapshot-scroll mt-2 min-h-0 flex-1 space-y-2.5 overflow-y-scroll pr-1">
          {/* Project rows */}
          {ganttData.projects.map((proj, idx) => {
            const startPct = Math.max(0, (proj.start.getTime() - minT) / (tRange * 86400000) * 100);
            const endPct = Math.min(100, (proj.end.getTime() - minT) / (tRange * 86400000) * 100);
            const barWidth = Math.max(1, endPct - startPct);
            const forecastPct = proj.forecast ? Math.min(100, (proj.forecast.getTime() - minT) / (tRange * 86400000) * 100) : null;
            const forecastWidth = forecastPct === null ? 0 : Math.max(0, forecastPct - endPct);
            const priority = proj.priority || 'medium';
            const isHighPriority = priority === 'high' || priority === 'critical';
            const rowTone = idx % 2 === 0 ? 'border-transparent bg-slate-50/70 dark:bg-white/[0.02]' : 'border-transparent bg-white/70 dark:bg-transparent';
            const rowHover = 'hover:border-blue-200/70 hover:bg-blue-50/50 dark:hover:border-blue-500/20 dark:hover:bg-blue-500/5';
            const priorityAccent = priority === 'critical'
              ? 'bg-violet-600 shadow-[0_0_0_4px_rgba(124,58,237,0.12)]'
              : priority === 'high'
                ? 'bg-indigo-500 shadow-[0_0_0_4px_rgba(99,102,241,0.12)]'
                : 'bg-slate-300 dark:bg-slate-700';
            const priorityPill = priority === 'critical'
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
              : priority === 'high'
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                : priority === 'low'
                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
            const plannedBarTone = priority === 'critical'
              ? 'bg-blue-100/80 dark:bg-blue-900/30 border-violet-300/80 dark:border-violet-500/35'
              : priority === 'high'
                ? 'bg-blue-100/80 dark:bg-blue-900/30 border-indigo-300/80 dark:border-indigo-500/35'
                : 'bg-blue-100/80 dark:bg-blue-900/30 border-blue-200/60 dark:border-blue-700/30';
            const progressBarTone = healthBg(proj.health);
            return (
              <button
                key={proj.projectId || proj.name}
                type="button"
                className={`flex w-full items-center rounded-xl border px-2 py-2 text-left transition-colors ${rowTone} ${rowHover} ${proj.projectId ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={() => openProjectWorkspace(proj.projectId)}
                disabled={!proj.projectId}
              >
                <div className="w-[138px] flex-shrink-0 flex items-center gap-2 py-1 px-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${priorityAccent}`} />
                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold text-foreground truncate block leading-tight">{proj.name}</span>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-[8px] text-muted-foreground capitalize leading-tight">{proj.phase}</span>
                      {isHighPriority ? (
                        <span className={`rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.12em] ${priorityPill}`}>{priority}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex-1 relative h-8">
                  {months.map((m) => (
                    <div key={`g-${m.label}`} className="absolute top-0 h-full border-l border-gray-100/50 dark:border-white/5" style={{ left: `${m.pct}%` }} />
                  ))}
                  {todayPct > 0 && todayPct < 100 && (
                    <div className="absolute top-0 h-full border-l-[1.5px] border-dashed border-red-400/50 z-10" style={{ left: `${todayPct}%` }}>
                      {idx === 0 && <span className="absolute -top-5 -translate-x-1/2 text-[7px] font-bold text-red-500 bg-white/90 dark:bg-card/90 px-1 py-px rounded-sm shadow-sm">TODAY</span>}
                    </div>
                  )}
                  <div className="absolute top-2 h-4 rounded-full overflow-hidden shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]" style={{ left: `${startPct}%`, width: `${barWidth}%` }}>
                    <div className={`h-full rounded-full border ${plannedBarTone}`} />
                    <div className={`absolute inset-y-0 left-0 rounded-full ${progressBarTone}`} style={{ width: `${proj.progress}%` }} />
                  </div>
                  {forecastWidth > 0 && (
                    <div className="absolute top-[0.95rem] h-2.5 rounded-full bg-amber-200/40 dark:bg-amber-500/15 border border-dashed border-amber-400/50" style={{ left: `${endPct}%`, width: `${forecastWidth}%` }} />
                  )}
                  {proj.progress > 0 && (
                    <span className="absolute top-[0.55rem] text-[8px] font-bold text-white drop-shadow-sm z-10" style={{ left: `${startPct + barWidth * 0.5}%`, transform: 'translateX(-50%)' }}>{proj.progress}%</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const _renderPortfolioHealthCard = () => (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/85 p-5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">Portfolio Health Score</p>
          <h3 className="mt-2 text-4xl font-black tracking-tight text-foreground">{portfolioHealthScore}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Single composite portfolio signal blending delivery, governance, risk, and compliance posture.</p>
        </div>
        <div className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${portfolioHealthScore >= 70 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : portfolioHealthScore >= 45 ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'}`}>
          {portfolioHealthScore >= 70 ? 'Healthy' : portfolioHealthScore >= 45 ? 'Fragile' : 'Intervention'}
        </div>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div className={`h-full rounded-full transition-all duration-700 ${portfolioHealthScore >= 70 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : portfolioHealthScore >= 45 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-rose-600 to-amber-500'}`} style={{ width: `${portfolioHealthScore}%` }} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/10">Drag index {portfolioDragIndex}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/10">Readiness {governanceReadinessScore}%</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/10">Value realization {valueRealizationScore}%</span>
      </div>
    </div>
  );

  const renderRiskHeatmapCard = () => (
    <div className="relative h-full min-h-[26rem] overflow-hidden rounded-2xl border border-slate-200/70 bg-white/85 p-5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-3 dark:border-white/10">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">Risk Heatmap</p>
          <p className="mt-1 text-xs text-muted-foreground">Impact × likelihood view of the active portfolio with the live risk radar beneath it.</p>
        </div>
        <div className="hidden rounded-full border border-slate-200/70 bg-slate-50/80 px-3 py-1 text-[10px] font-semibold text-muted-foreground dark:border-white/10 dark:bg-slate-950/30 sm:block">
          Unified risk view
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <div className="grid grid-cols-[72px_repeat(3,minmax(0,1fr))] gap-2 text-center text-[10px]">
          <div />
          {['Low', 'Medium', 'High'].map((label) => <div key={label} className="font-semibold text-muted-foreground">{label}</div>)}
          {(['high', 'medium', 'low'] as const).map((impact) => (
            <div key={impact} className="contents">
              <div className="flex items-center justify-start text-[10px] font-semibold text-muted-foreground">{impact === 'high' ? 'High impact' : impact === 'medium' ? 'Medium impact' : 'Low impact'}</div>
              {(['low', 'medium', 'high'] as const).map((likelihood) => {
                const count = riskHeatmap[impact][likelihood];
                const tone = impact === 'high' && likelihood === 'high'
                  ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
                  : impact === 'low' && likelihood === 'low'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
                return <div key={`${impact}-${likelihood}`} className={`rounded-xl border px-2 py-3 font-semibold ${tone}`}>{count}</div>;
              })}
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200/70 pt-4 dark:border-white/10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">Risk Radar</p>
              <p className="mt-1 text-xs text-muted-foreground">Top operational risks, ownership gaps, blockers, and exposure requiring intervention.</p>
            </div>
            <div className="text-right text-[10px] text-muted-foreground">
              <div className="font-semibold text-foreground">{(totalModeledRiskExposure / 1000000).toFixed(1)}M AED</div>
              <div>modeled exposure</div>
            </div>
          </div>
          <div className="space-y-4">
            {riskRadarItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/70 px-4 py-5 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                No projects currently meet the risk-radar threshold.
              </div>
            ) : riskRadarItems.map((item) => {
              const levelBorder = item.level === 'Critical'
                ? 'border-rose-200 dark:border-rose-500/25'
                : item.level === 'Elevated'
                  ? 'border-amber-200 dark:border-amber-500/25'
                  : 'border-slate-200 dark:border-white/10';
              const levelBadgeCls = item.level === 'Critical'
                ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25'
                : item.level === 'Elevated'
                  ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25'
                  : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/10';
              return (
                <div key={item.id} className={`rounded-xl border p-3 ${levelBorder}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${levelBadgeCls}`}>{item.level}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                        <span>{item.department}</span>
                        <span className={item.ownerMissing ? 'font-semibold text-rose-600 dark:text-rose-400' : ''}>{item.ownerMissing ? '⚠ Owner missing' : item.owner}</span>
                        <span>{item.scheduleSlipDays}d slip</span>
                      </div>
                      {item.blockedBy.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {item.blockedBy.map((blocker) => (
                            <span key={blocker} className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">{blocker}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-black leading-none text-foreground">{(item.modeledExposureAed / 1000000).toFixed(1)}M</p>
                      <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">AED</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => queuePmoAction('Risk escalation drafted', `Escalate the top PMO risk for ${item.name}. Include financial exposure, schedule impact, blockers, and required executive decision.`)}>Escalate</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => queuePmoAction('Recovery plan request drafted', `Draft a recovery plan request for ${item.name}. Cover root cause, recovery milestones, budget ask, and governance checkpoints.`)}>Recovery Plan</Button>
                    <Button size="sm" className="h-7 bg-slate-900 text-[11px] text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200" onClick={() => openProjectWorkspace(item.projectId)}>Open Project</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const renderBudgetPerformancePanel = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-2 text-center dark:border-blue-800/30 dark:bg-blue-500/10">
          <p className="text-[8px] uppercase tracking-wide text-muted-foreground">Approved</p>
          <p className="mt-1 text-sm font-bold text-foreground">{snapshotPortfolioBudget > 0 ? `${(snapshotPortfolioBudget / 1000000).toFixed(1)}M` : '0'}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-2 text-center dark:border-amber-800/30 dark:bg-amber-500/10">
          <p className="text-[8px] uppercase tracking-wide text-muted-foreground">Spent</p>
          <p className="mt-1 text-sm font-bold text-amber-600">{snapshotPortfolioSpend > 0 ? `${(snapshotPortfolioSpend / 1000000).toFixed(1)}M` : '0'}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-2 text-center dark:border-emerald-800/30 dark:bg-emerald-500/10">
          <p className="text-[8px] uppercase tracking-wide text-muted-foreground">{snapshotBudgetOverage > 0 ? 'Over' : 'Left'}</p>
          <p className={`mt-1 text-sm font-bold ${snapshotBudgetOverage > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{snapshotBudgetRemainingText}</p>
        </div>
      </div>
      <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
        {renderBudgetProjectBars()}
      </div>

      <div className="mt-4 border-t border-slate-200/70 pt-4 dark:border-white/10">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">Earned Value Analysis</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className={`rounded-xl p-2.5 text-center border ${perfBgBorder(snapshotPortfolioCPI)}`}>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Cost Performance</p>
            <p className={`text-xl font-black leading-none ${perfText(snapshotPortfolioCPI)}`}>{snapshotPortfolioCPI != null ? snapshotPortfolioCPI.toFixed(2) : '—'}</p>
            <p className="text-[9px] text-muted-foreground mt-1">{cpiLabel(snapshotPortfolioCPI)}</p>
          </div>
          <div className={`rounded-xl p-2.5 text-center border ${perfBgBorder(snapshotPortfolioSPI)}`}>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Schedule Performance</p>
            <p className={`text-xl font-black leading-none ${perfText(snapshotPortfolioSPI)}`}>{snapshotPortfolioSPI != null ? snapshotPortfolioSPI.toFixed(2) : '—'}</p>
            <p className="text-[9px] text-muted-foreground mt-1">{spiLabel(snapshotPortfolioSPI)}</p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Earned Value (EV)', value: snapshotPortfolioEarnedValue, max: snapshotPortfolioBudget, color: 'bg-blue-500' },
            { label: 'Actual Cost (AC)', value: snapshotPortfolioSpend, max: snapshotPortfolioBudget, color: snapshotPortfolioSpend > snapshotPortfolioEarnedValue ? 'bg-red-500' : 'bg-emerald-500' },
            { label: 'Planned Value (PV)', value: snapshotPortfolioBudget, max: snapshotPortfolioBudget, color: 'bg-gray-400' },
          ].map((ev) => (
            <div key={ev.label}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-muted-foreground">{ev.label}</span>
                <span className="text-[10px] font-semibold text-foreground">{ev.value > 0 ? `${(ev.value / 1000000).toFixed(2)}M` : '0'}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                <div className={`h-1.5 rounded-full ${ev.color} transition-all`} style={{ width: `${ev.max > 0 ? Math.min((ev.value / ev.max) * 100, 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderGovernanceLifecycleCard = () => (
    <div className="relative h-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white/85 p-3.5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2 dark:border-white/10">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">Lifecycle Governance</p>
        <Badge variant="outline" className="h-5 text-[9px]">{gateLifecycleStages.length} stages</Badge>
      </div>

      <div className="mt-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">Gate Pipeline</p>
          <Button size="sm" variant="outline" className="h-6 text-[9px]" onClick={() => { setActiveTab('approvals'); setApprovalSubTab('gates'); }}>Review Gates</Button>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {gateLifecycleStages.map((stage) => (
            <div key={stage.label} className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-slate-950/30">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-medium text-foreground">{stage.label}</span>
                <span className="text-muted-foreground">{stage.count} · {stage.share}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400" style={{ width: `${stage.share}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">Overdue approvals</p>
            <p className="mt-1 text-base font-black leading-none text-foreground">{overdueGateApprovals}</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-slate-950/30">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">Approval pressure</p>
            <p className="mt-1 text-base font-black leading-none text-foreground">{approvalPressureScore}%</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOverviewTab = () => (
    <TabsContent value="overview" className="space-y-4">

      <div
        className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-white via-white/95 to-indigo-50/30 dark:from-slate-950 dark:via-slate-900/80 dark:to-indigo-950/30 shadow-[0_10px_40px_-12px_rgba(30,41,59,0.15)] dark:shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)]"
        data-testid="pmo-executive-header"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(0deg,transparent 24%,rgba(99,102,241,.5) 25%,rgba(99,102,241,.5) 26%,transparent 27%,transparent 74%,rgba(99,102,241,.5) 75%,rgba(99,102,241,.5) 76%,transparent 77%),linear-gradient(90deg,transparent 24%,rgba(99,102,241,.5) 25%,rgba(99,102,241,.5) 26%,transparent 27%,transparent 74%,rgba(99,102,241,.5) 75%,rgba(99,102,241,.5) 76%,transparent 77%)', backgroundSize: '60px 60px' }} />
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative flex items-center justify-between gap-3 px-6 py-2 border-b border-border/30 bg-white/30 dark:bg-slate-950/30 backdrop-blur-xl">
          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
            <span className="flex items-center gap-1.5">
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${portfolioTotal > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                <span className={`absolute inset-0 rounded-full ${portfolioTotal > 0 ? 'bg-emerald-500' : 'bg-amber-500'} opacity-60 animate-ping`} />
              </span>
              {portfolioTotal > 0 ? 'Live · Governed' : 'Awaiting Portfolio Data'}
            </span>
            <span className="hidden sm:inline text-border/60">|</span>
            <span className="hidden sm:inline">PMO Control Plane</span>
            <span className="hidden md:inline text-border/60">|</span>
            <span className="hidden md:inline">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            <Clock className="h-3 w-3" />
            <span>Refreshed {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <div className="relative px-6 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                  <Crown className="h-5 w-5" />
                </div>
                <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-950 ${portfolioTotal > 0 ? (portfolioHealthScore >= 70 ? 'bg-emerald-500' : portfolioHealthScore >= 40 ? 'bg-amber-500' : 'bg-red-500') : 'bg-slate-400'}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-tight">PMO Executive Dashboard</h2>
                  <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider border-indigo-300/60 text-indigo-700 dark:text-indigo-300 dark:border-indigo-500/40 bg-indigo-50/60 dark:bg-indigo-500/10">Tier 1</Badge>
                </div>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                  <span>Enterprise portfolio intelligence • governance • delivery assurance</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0 xl:justify-end">
              <Button className="gap-2 bg-gradient-to-r from-indigo-500 to-blue-600 text-white hover:from-indigo-600 hover:to-blue-700 font-semibold shadow-md" size="sm" onClick={() => setCreateProjectDialogOpen(true)} data-testid="button-open-pmo-create-project">
                <Plus className="h-4 w-4" /> New Project
              </Button>
              <Link href="/intelligent-portfolio">
                <Button variant="outline" size="sm" className="bg-white/60 dark:bg-white/5 backdrop-blur-sm border-border/50"><Layers className="h-4 w-4 mr-1.5" /> Portfolio Hub</Button>
              </Link>
              <Link href="/intelligent-portfolio?tab=pipeline">
                <Button variant="outline" size="sm" className="relative bg-white/60 dark:bg-white/5 backdrop-blur-sm border-border/50">
                  <GitBranch className="h-4 w-4 mr-1.5" /> Pipeline
                  {pipelineCount > 0 && <Badge className="ml-1.5 px-1.5 py-0 text-[10px] bg-amber-500 text-white border-0">{pipelineCount}</Badge>}
                </Button>
              </Link>
              {pendingEvidenceItems.length > 0 && (
                <Button variant="outline" size="sm" className="relative bg-amber-50/60 dark:bg-amber-500/10 border-amber-300/60 hover:bg-amber-100/80 dark:hover:bg-amber-500/20 dark:border-amber-500/30" onClick={() => { setEvidencePanelOpen(true); setEvidencePanelDismissed(false); }}>
                  <Shield className="h-4 w-4 mr-1.5 text-amber-600 dark:text-amber-400" /> Review
                  <Badge className="ml-1.5 px-1.5 py-0 text-[10px] bg-red-500 text-white border-0">{pendingEvidenceItems.length}</Badge>
                </Button>
              )}
            </div>
          </div>

          <div className="mt-2 border-t border-border/40 pt-2">
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7" data-testid="executive-layer-kpis-row">
                {executiveKpis.map((item) => (
                  <div key={item.label} className={`rounded-xl border px-3 py-3 ${item.tone} flex flex-col`}>
                    {/* icon + label — fixed single line */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <item.icon className={`h-3 w-3 shrink-0 ${item.iconColor}`} />
                      <p className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80 leading-none truncate">{item.label}</p>
                    </div>
                    {/* value — fixed height, auto-shrink long values */}
                    <p className="text-[18px] font-black tracking-tight text-foreground leading-none mb-2 truncate">{item.value}</p>
                    {/* hint — fixed 2-line clamp, same height across all cards */}
                    <p className="text-[9px] text-muted-foreground leading-[1.4] line-clamp-2 mt-auto min-h-[2.4em]">{item.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.48fr)_minmax(0,0.92fr)] xl:items-stretch">
        <div className="xl:col-start-1 xl:row-start-1">
          {renderGanttTimeline()}
        </div>

        <div className="xl:col-start-2 xl:row-start-1">
          <div className="relative h-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white/85 p-3.5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-white/[0.04]">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2 dark:border-white/10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">Budget Performance</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={projectsSnapshotSegment} onValueChange={setProjectsSnapshotSegment}>
                  <SelectTrigger className="h-5 w-[140px] rounded-md border-slate-200/70 bg-white/80 px-1.5 text-[8px] dark:border-white/10 dark:bg-slate-950/40">
                    <SelectValue placeholder="All segments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All segments</SelectItem>
                    {projectsSnapshotSegments.map((segment) => (
                      <SelectItem key={segment} value={segment}>{segment}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant={budgetBadgeVariant(snapshotBudgetUtilization)} className="h-5 text-[9px]">{snapshotBudgetUtilization}% used</Badge>
              </div>
            </div>
            {renderBudgetPerformancePanel()}
          </div>
        </div>

        <div className="xl:col-start-1 xl:row-start-2">
          {renderRiskHeatmapCard()}
        </div>

        <div className="xl:col-start-2 xl:row-start-2">
          {renderGovernanceLifecycleCard()}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-1">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/85 p-5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-white/[0.04]">
          <div className="border-b border-slate-200/70 pb-3 dark:border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">Cross-Project Impact</p>
            <p className="mt-1 text-xs text-muted-foreground">Coupled program signals and blocked-by indicators where delays can propagate across the portfolio.</p>
          </div>
          <div className="mt-4 space-y-2.5">
            {crossProjectImpactSignals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-950/30">
                No cross-project propagation cluster is visible yet.
              </div>
            ) : crossProjectImpactSignals.map((signal) => (
              <div key={signal.department} className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-3 dark:border-white/10 dark:bg-slate-950/30">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-foreground">{signal.department}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{signal.count} active projects • {signal.atRisk} at risk • {signal.blocked} blocked by approvals or control points.</p>
                  </div>
                  <div className="text-right text-[10px]">
                    <p className="font-semibold text-foreground">{(signal.exposure / 1000000).toFixed(1)}M</p>
                    <p className="text-muted-foreground">budget</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      {/* ═══════════════════════════════════════════════════════════════
          FINANCIAL INTELLIGENCE & PERFORMANCE
          ═══════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-7 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/30" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Financial Intelligence</h3>
          <div className="flex-1 h-px bg-gradient-to-r from-emerald-200/60 via-teal-100/30 to-transparent dark:from-emerald-500/20 dark:via-teal-500/10" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-white/85 p-4 shadow-[0_10px_32px_-24px_rgba(16,185,129,0.35)] dark:border-emerald-500/20 dark:bg-white/[0.04] lg:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-emerald-100/70 pb-2 dark:border-emerald-500/20">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">Funding by Lifecycle Phase</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Planned vs actual consumption across active delivery phases for the selected segment.</p>
              </div>
              <Badge variant="outline" className="h-5 text-[9px]">{financialPhaseData.length} phases</Badge>
            </div>
            <ResponsiveContainer width="100%" height={228}>
              <BarChart data={financialPhaseData} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-white/10" />
                <XAxis dataKey="phase" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(value) => `${(Number(value) / 1000000).toFixed(1)}M`} />
                <RechartsTooltip content={({ active, payload }: TooltipProps<number, string>) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as { phase: string; budget: number; spend: number; burnPct: number; variance: number; count: number };
                  return (
                    <div className="rounded-lg border bg-background/95 shadow-lg backdrop-blur-sm px-3 py-2 text-xs space-y-1">
                      <p className="font-semibold">{row.phase}</p>
                      <p>Planned: {(row.budget / 1000000).toFixed(2)}M AED</p>
                      <p>Spent: {(row.spend / 1000000).toFixed(2)}M AED ({row.burnPct}%)</p>
                      <p className={row.variance > 0 ? 'text-red-600' : 'text-emerald-600'}>
                        Variance: {(Math.abs(row.variance) / 1000000).toFixed(2)}M AED {row.variance > 0 ? 'over' : 'under'}
                      </p>
                      <p>{row.count} projects</p>
                    </div>
                  );
                }} />
                <Bar dataKey="budget" name="Planned" radius={[6, 6, 0, 0]} fill="#60a5fa" />
                <Bar dataKey="spend" name="Actual" radius={[6, 6, 0, 0]} fill="#14b8a6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/85 p-4 shadow-[0_10px_32px_-24px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.04]">
            <div className="mb-3 border-b border-slate-200/70 pb-2 dark:border-white/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">Variance Hotspots</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Largest budget deviations requiring PMO intervention.</p>
            </div>
            <div className="space-y-2 max-h-[228px] overflow-y-auto pr-1">
              {financialVarianceProjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-xs text-muted-foreground dark:border-white/10 dark:bg-slate-950/30">
                  No financial variance signal is available for the selected segment.
                </div>
              ) : financialVarianceProjects.map((project) => (
                <div key={project.id} className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-slate-950/30">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-semibold text-foreground">{project.name}</p>
                    <span className={`text-[10px] font-bold ${project.variance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {(Math.abs(project.variance) / 1000000).toFixed(2)}M
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
                    <span>Budget {(project.budget / 1000000).toFixed(2)}M</span>
                    <span>Spent {(project.spend / 1000000).toFixed(2)}M</span>
                    <span>{project.utilization}% burn</span>
                  </div>
                </div>
              ))}
            </div>
            {worstVarianceProject ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[10px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                PMO focus: {worstVarianceProject.name} carries the highest variance in this segment.
              </div>
            ) : null}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-cyan-200/70 bg-white/85 p-4 shadow-[0_10px_32px_-24px_rgba(6,182,212,0.35)] dark:border-cyan-500/20 dark:bg-white/[0.04] lg:col-span-3">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-cyan-100/70 pb-2 dark:border-cyan-500/20">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">Capital Efficiency Map</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Each bubble = one project. X: budget burn, Y: progress, size: approved budget.</p>
              </div>
              <Badge variant="outline" className="h-5 text-[9px]">{financialEfficiencyPoints.length} projects</Badge>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <ScatterChart margin={{ top: 10, right: 8, bottom: 6, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-white/10" />
                <XAxis type="number" dataKey="utilization" name="Burn" unit="%" domain={[0, 140]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis type="number" dataKey="progress" name="Progress" unit="%" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <ZAxis type="number" dataKey="budget" range={[45, 420]} />
                <RechartsTooltip content={({ active, payload }: TooltipProps<number, string>) => {
                  if (!active || !payload?.[0]?.payload) return null;
                  const row = payload[0].payload as { name: string; utilization: number; progress: number; budget: number; cpi: number | null };
                  return (
                    <div className="rounded-lg border bg-background/95 shadow-lg backdrop-blur-sm px-3 py-2 text-xs space-y-1">
                      <p className="font-semibold">{row.name}</p>
                      <p>Burn: {row.utilization}% • Progress: {row.progress}%</p>
                      <p>Budget: {(row.budget / 1000000).toFixed(2)}M AED</p>
                      <p>CPI: {row.cpi != null ? row.cpi.toFixed(2) : 'N/A'}</p>
                    </div>
                  );
                }} />
                <Scatter data={financialEfficiencyPoints} shape="circle">
                  {financialEfficiencyPoints.map((point) => (
                    <Cell key={point.id} fill={healthHex(point.health)} fillOpacity={0.75} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PROJECTS SUMMARY — by Priority
          ═══════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-7 w-1 rounded-full bg-gradient-to-b from-rose-500 to-amber-400 shadow-sm shadow-rose-500/30" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Projects by Priority</h3>
          <div className="flex-1 h-px bg-gradient-to-r from-rose-200/60 via-amber-100/30 to-transparent dark:from-rose-500/20 dark:via-amber-500/10" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {priorityGroups.map((group) => {
            const defaultAccent = { gradient: 'from-blue-100/60 via-blue-50/30 to-transparent dark:from-blue-950/30 dark:via-blue-900/10', border: 'border-blue-200/60 dark:border-blue-500/20', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' };
            const PRIO_ACCENT = {
              high: { gradient: 'from-rose-100/60 via-rose-50/30 to-transparent dark:from-rose-950/30 dark:via-rose-900/10', border: 'border-rose-200/60 dark:border-rose-500/20', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' },
              medium: defaultAccent,
              low: { gradient: 'from-emerald-100/60 via-emerald-50/30 to-transparent dark:from-emerald-950/30 dark:via-emerald-900/10', border: 'border-emerald-200/60 dark:border-emerald-500/20', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
            } as const;
            const accent = PRIO_ACCENT[group.priority] || defaultAccent;
            return (
              <div key={group.priority} className={`relative overflow-hidden rounded-xl bg-white/80 dark:bg-card/40 backdrop-blur-sm border ${accent.border} shadow-sm hover:shadow-md transition-all`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${accent.gradient} pointer-events-none`} />
                <div className="relative">
                  <div className="px-4 pt-3 pb-2.5 border-b border-gray-100/60 dark:border-white/5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-foreground">{group.label} Priority</h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${accent.badge}`}>{group.count} projects</span>
                    </div>
                    {group.totalBudget > 0 && (
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground">{group.spendPct}% consumed</span>
                            <span className="text-[10px] font-semibold text-foreground">${(group.totalBudget / 1000000).toFixed(1)}M total</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                            <div className="h-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400 transition-all" style={{ width: `${Math.min(group.spendPct, 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5 space-y-2 max-h-[280px] overflow-y-auto">
                    {group.count === 0 && (
                      <div className="text-center py-6 text-xs text-muted-foreground">No {group.label.toLowerCase()} priority projects</div>
                    )}
                    {group.projects.slice(0, 5).map(renderProjectCard)}
                    {group.projects.length > 5 && (
                      <p className="text-center text-[10px] text-muted-foreground pt-1">+{group.projects.length - 5} more</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          EXECUTION ANALYSIS
          ═══════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-7 w-1 rounded-full bg-gradient-to-b from-blue-500 to-cyan-400 shadow-sm shadow-blue-500/30" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Execution Analysis</h3>
          <div className="flex-1 h-px bg-gradient-to-r from-blue-200/60 via-cyan-100/30 to-transparent dark:from-blue-500/20 dark:via-cyan-500/10" />
        </div>
        <div>
          {/* Execution Matrix */}
          <div className="relative overflow-hidden rounded-2xl p-5 bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl border border-white/70 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.02] dark:ring-white/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-violet-500" />
                <h4 className="text-sm font-semibold text-foreground">Execution Matrix</h4>
              </div>
              <span className="text-[10px] text-muted-foreground">Progress vs Budget Burn</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-white/10" />
                <XAxis type="number" dataKey="progress" name="Progress" unit="%" domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis type="number" dataKey="burnRate" name="Burn Rate" unit="%" domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <ZAxis type="number" dataKey="budget" range={[40, 400]} />
                <RechartsTooltip content={({ active, payload }: TooltipProps<number, string>) => {
                  if (!active || !payload?.[0]?.payload) return null;
                  const d = payload[0].payload as { fullName: string; progress: number; burnRate: number; health: string; phase: string };
                  return (
                    <div className="rounded-lg border bg-background/95 shadow-lg backdrop-blur-sm px-3 py-2 text-xs space-y-1">
                      <p className="font-semibold">{d.fullName}</p>
                      <p>Progress: {d.progress}% &bull; Burn: {d.burnRate}%</p>
                      <p className="capitalize">Health: {d.health?.replaceAll('_', ' ')} &bull; Phase: {d.phase}</p>
                    </div>
                  );
                }} />
                <Scatter data={executionMatrixData} shape="circle">
                  {executionMatrixData.map((entry) => (
                    <Cell key={entry.name} fill={healthHex(entry.health)} fillOpacity={0.75} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          QUALITY, EVIDENCE & PHASE VELOCITY
          ═══════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-7 w-1 rounded-full bg-gradient-to-b from-teal-500 to-emerald-400 shadow-sm shadow-teal-500/30" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Quality & Evidence</h3>
          <div className="flex-1 h-px bg-gradient-to-r from-teal-200/60 via-emerald-100/30 to-transparent dark:from-teal-500/20 dark:via-emerald-500/10" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* QA Evidence Summary */}
          <div className="relative overflow-hidden rounded-2xl p-5 bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl border border-white/70 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.02] dark:ring-white/5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-teal-500" />
              <h4 className="text-sm font-semibold text-foreground">QA & Evidence</h4>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: 'Pending', value: qaPendingEvidence, bg: 'bg-amber-50/80 dark:bg-amber-500/10', border: 'border-amber-100 dark:border-amber-800/30', color: 'text-amber-600' },
                { label: 'Approved', value: qaApprovedEvidence, bg: 'bg-emerald-50/80 dark:bg-emerald-500/10', border: 'border-emerald-100 dark:border-emerald-800/30', color: 'text-emerald-600' },
                { label: 'Rejected', value: qaRejectedEvidence, bg: 'bg-red-50/80 dark:bg-red-500/10', border: 'border-red-100 dark:border-red-800/30', color: 'text-red-600' },
              ].map((stat) => (
                <div key={stat.label} className={`rounded-lg ${stat.bg} backdrop-blur-sm p-2 text-center border ${stat.border}`}>
                  <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[9px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {qaProjects.slice(0, 5).map((qa) => {
                const total = qa.summary.totalTasks || 1;
                const withEvidence = qa.summary.tasksWithEvidence;
                const coverage = Math.round((withEvidence / total) * 100);
                return (
                  <div key={qa.project.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-medium text-foreground truncate max-w-[70%]">{qa.project.projectName}</span>
                      <span className="text-[10px] text-muted-foreground">{coverage}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 transition-all" style={{ width: `${coverage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Phase Velocity Tracker */}
          <div className="relative overflow-hidden rounded-2xl p-5 bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl border border-white/70 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.02] dark:ring-white/5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-indigo-500" />
              <h4 className="text-sm font-semibold text-foreground">Phase Velocity</h4>
              <span className="text-[10px] text-muted-foreground ml-auto">Avg days in phase</span>
            </div>
            <div className="space-y-2.5">
              {phaseVelocityData.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground">No phase data</div>
              )}
              {phaseVelocityData.slice(0, 8).map((pv) => {
                const maxDays = Math.max(...phaseVelocityData.map(d => d.avgDays), 1);
                return (
                  <div key={pv.phase}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-foreground">{pv.phase}</span>
                        <span className="text-[9px] text-muted-foreground">({pv.count})</span>
                      </div>
                      <span className={`text-[10px] font-bold ${velocityText(pv.avgDays)}`}>{pv.avgDays}d</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                      <div className={`h-1.5 rounded-full transition-all ${velocityBg(pv.avgDays)}`} style={{ width: `${(pv.avgDays / maxDays) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PROJECTS BY PRIORITY BAR + PROJECTS TABLE
          ═══════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-7 w-1 rounded-full bg-gradient-to-b from-amber-500 to-orange-400 shadow-sm shadow-amber-500/30" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Active Projects</h3>
          <div className="flex-1 h-px bg-gradient-to-r from-amber-200/60 via-orange-100/30 to-transparent dark:from-amber-500/20 dark:via-orange-500/10" />
        </div>

        {/* Priority Distribution Bar */}
        <div className="relative overflow-hidden rounded-2xl p-5 bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl border border-white/70 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.02] dark:ring-white/5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <h4 className="text-sm font-semibold text-foreground">Priority × Health Distribution</h4>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={priorityData} margin={{ top: 5, right: 10, bottom: 5, left: 5 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-white/10" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis dataKey="priority" type="category" tick={{ fontSize: 11, fill: '#6b7280' }} width={65} />
              <RechartsTooltip />
              <Bar dataKey="onTrack" name="On Track" stackId="a" fill="#6366f1" maxBarSize={22} />
              <Bar dataKey="atRisk" name="At Risk" stackId="a" fill="#f59e0b" radius={[0, 6, 6, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Projects Table */}
        <div className="relative overflow-hidden rounded-2xl bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl border border-white/70 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.02] dark:ring-white/5 overflow-hidden">
          <div className="px-5 pt-3 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-indigo-500" />
              <h4 className="text-sm font-semibold text-foreground">Active Projects Overview</h4>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100/80 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 backdrop-blur-sm">{activeExecutionProjects.length} projects</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-gray-50/60 dark:bg-white/5">
                  <TableHead className="text-[10px] uppercase tracking-wider w-[200px] pl-5 font-semibold">Project</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Phase</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Priority</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Health</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider w-[140px] font-semibold">Progress</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-right font-semibold">Budget</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-right pr-5 font-semibold">Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeExecutionProjects.slice(0, 10).map(renderProjectTableRow)}
                {activeExecutionProjects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">No active projects</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {activeExecutionProjects.length > 10 && (
            <div className="px-5 py-2 border-t border-gray-100/60 dark:border-white/5 text-center">
              <Link href="/intelligent-portfolio">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                  View all {activeExecutionProjects.length} projects <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

    </TabsContent>
  );

  const renderPortfolioUnitsTab = () => (
    <TabsContent value="portfolio-units" className="space-y-6">
      <Card className="border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/75">
        <CardHeader className="border-b border-slate-200/60 bg-slate-50/70 dark:border-slate-800/80 dark:bg-slate-900/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Portfolio Management Units</CardTitle>
              <CardDescription>Define sector portfolio units, assign managers, grant access, and link projects for PMO roll-up.</CardDescription>
            </div>
            <Button onClick={() => setCreatePortfolioUnitDialogOpen(true)} className="gap-2" size="sm" data-testid="button-create-portfolio-unit">
              <Plus className="h-4 w-4" /> New Unit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {portfolioUnits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300/80 bg-slate-50/70 px-4 py-6 text-sm text-muted-foreground">
              No portfolio units configured yet. Create the first unit to start PMO-to-portfolio operating model.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {portfolioUnits.map((unit) => (
                <div key={unit.id} className="rounded-xl border border-slate-200/80 bg-white/85 p-4 dark:border-slate-700/50 dark:bg-slate-900/50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{unit.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">Sector: {unit.sector}</p>
                      <p className="text-xs text-muted-foreground">Manager: {unit.manager?.displayName || 'Not assigned'}</p>
                    </div>
                    <Badge variant={unit.status === 'active' ? 'default' : 'secondary'}>{unit.status}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <div className="rounded-lg border border-slate-200/70 bg-slate-50/70 px-2 py-2 dark:border-slate-700/40 dark:bg-slate-900/40">
                      <div className="font-semibold text-foreground">{unit.projectCount}</div>
                      <div className="text-muted-foreground">Projects</div>
                    </div>
                    <div className="rounded-lg border border-slate-200/70 bg-slate-50/70 px-2 py-2 dark:border-slate-700/40 dark:bg-slate-900/40">
                      <div className="font-semibold text-foreground">{unit.atRiskCount}</div>
                      <div className="text-muted-foreground">At Risk</div>
                    </div>
                    <div className="rounded-lg border border-slate-200/70 bg-slate-50/70 px-2 py-2 dark:border-slate-700/40 dark:bg-slate-900/40">
                      <div className="font-semibold text-foreground">{unit.memberCount}</div>
                      <div className="text-muted-foreground">Members</div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Budget: AED {(unit.totalBudget / 1000000).toFixed(1)}M</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{unit.description || 'No unit description set.'}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
              <p className="text-sm font-semibold text-foreground">Assign Access</p>
              <p className="text-xs text-muted-foreground mt-1">Add users to a portfolio unit as manager, analyst, or viewer.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <Select value={selectedUnitIdForMembership} onValueChange={setSelectedUnitIdForMembership}>
                  <SelectTrigger><SelectValue placeholder="Portfolio Unit" /></SelectTrigger>
                  <SelectContent>
                    {portfolioUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={memberUserId} onValueChange={setMemberUserId}>
                  <SelectTrigger><SelectValue placeholder="User" /></SelectTrigger>
                  <SelectContent>
                    {allUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{user.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={memberRole} onValueChange={(value) => setMemberRole(value as 'manager' | 'analyst' | 'viewer')}>
                  <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="analyst">Analyst</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="mt-3"
                size="sm"
                onClick={() => addPortfolioUnitMemberMutation.mutate()}
                disabled={!selectedUnitIdForMembership || !memberUserId || addPortfolioUnitMemberMutation.isPending}
              >
                {addPortfolioUnitMemberMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Add Member
              </Button>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
              <p className="text-sm font-semibold text-foreground">Link Projects to Unit</p>
              <p className="text-xs text-muted-foreground mt-1">Each project manager workspace stays linked through this portfolio unit assignment.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <Select value={selectedUnitIdForProject} onValueChange={setSelectedUnitIdForProject}>
                  <SelectTrigger><SelectValue placeholder="Portfolio Unit" /></SelectTrigger>
                  <SelectContent>
                    {portfolioUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedProjectIdForUnit} onValueChange={setSelectedProjectIdForUnit}>
                  <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                  <SelectContent>
                    {allProjects.map((project) => (
                      <SelectItem key={String(project.id)} value={String(project.id)}>{project.projectName || project.projectCode || String(project.id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="mt-3"
                size="sm"
                onClick={() => assignProjectToUnitMutation.mutate()}
                disabled={!selectedUnitIdForProject || !selectedProjectIdForUnit || assignProjectToUnitMutation.isPending}
              >
                {assignProjectToUnitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Link Project
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createPortfolioUnitDialogOpen} onOpenChange={setCreatePortfolioUnitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Portfolio Management Unit</DialogTitle>
            <DialogDescription>Set up a new sector unit and assign its portfolio manager.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="portfolio-unit-name">Unit Name</Label>
              <Input id="portfolio-unit-name" value={portfolioUnitName} onChange={(event) => setPortfolioUnitName(event.target.value)} placeholder="Energy Portfolio Unit" />
            </div>
            <div>
              <Label htmlFor="portfolio-unit-sector">Sector</Label>
              <Input id="portfolio-unit-sector" value={portfolioUnitSector} onChange={(event) => setPortfolioUnitSector(event.target.value)} placeholder="Energy" />
            </div>
            <div>
              <Label htmlFor="portfolio-unit-description">Description</Label>
              <Textarea id="portfolio-unit-description" value={portfolioUnitDescription} onChange={(event) => setPortfolioUnitDescription(event.target.value)} placeholder="Portfolio mandate and operating scope" />
            </div>
            <div>
              <Label>Portfolio Manager</Label>
              <Select value={portfolioUnitManagerUserId} onValueChange={setPortfolioUnitManagerUserId}>
                <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent>
                  {allUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatePortfolioUnitDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createPortfolioUnitMutation.mutate()} disabled={!portfolioUnitName.trim() || createPortfolioUnitMutation.isPending}>
              {createPortfolioUnitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create Unit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );

  const renderContent = () => (
    <div className="h-screen flex flex-col bg-background" data-testid="gateway-pmo">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="flex flex-col h-full w-full">

          {/* ── Flex layout: COREVIA Panel + Content ── */}
          <div className="flex flex-1 min-h-0">
            {/* ── COREVIA Intelligence Panel (Left Sidebar) ── */}
            <Suspense fallback={null}>
              <PMOOfficeAssistantSurface
                activeTab={activeTab}
                navigationItems={pmoNavigationItems}
                onTabChange={setActiveTab}
                pmoChatOpen={pmoChatOpen}
                onToggleChat={() => setPmoChatOpen((open) => !open)}
                currentUserName={currentUser?.displayName || currentUser?.username || "PMO"}
                currentUserInitial={currentUser?.displayName?.[0] || "U"}
                voiceEnabled={voiceEnabled}
                isSpeaking={isSpeaking}
                onToggleVoice={() => {
                  if (isSpeaking) {
                    stopSpeaking();
                    return;
                  }

                  toggleVoice();
                }}
                onlineUsers={onlineUsers}
                executiveFeed={unifiedExecutiveFeed}
              />
            </Suspense>

            {/* ── Main Content Area ── */}
            <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="px-4 pt-0 pb-4 space-y-4">
              {renderOverviewTab()}
              {renderPortfolioUnitsTab()}

              <TabsContent value="approvals" className="space-y-6">
                <Card className="border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/75">
                  <CardHeader className="border-b border-slate-200/60 bg-slate-50/70 dark:border-slate-800/80 dark:bg-slate-900/60">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950">
                            <ClipboardCheck className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Approvals</p>
                            <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">PMO decision workbench</h2>
                          </div>
                        </div>
                        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                          Review conversion, baseline, gate, and change decisions from one clear operating surface.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-slate-300/80 bg-white/90 text-slate-700 dark:border-slate-600/60 dark:bg-slate-950/70 dark:text-slate-300">
                          {activeApprovalLane.label}
                        </Badge>
                        <Badge variant="outline" className="border-slate-300/80 bg-white/90 text-slate-700 dark:border-slate-600/60 dark:bg-slate-950/70 dark:text-slate-300">
                          {activeApprovalLane.sla}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 p-5 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-700/40 dark:bg-slate-900/60">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Open decisions</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{totalPendingApprovals}</div>
                      <p className="mt-1 text-xs text-muted-foreground">Across intake, WBS, gates, and execution controls.</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                      <div className="text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">Executive agenda</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{executiveDecisionAgenda.length}</div>
                      <p className="mt-1 text-xs text-muted-foreground">Items that should move first if leadership attention is needed.</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                      <div className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Control posture</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{governanceReadinessScore}%</div>
                      <p className="mt-1 text-xs text-muted-foreground">Current readiness signal for board control and operating hygiene.</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid items-start gap-6 xl:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="relative z-20 lg:sticky lg:top-24 lg:self-start">
                    <Card className="overflow-hidden border-slate-200/70 bg-white shadow-sm dark:border-slate-700/40 dark:bg-slate-950/70">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Scale className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                          Board lanes
                        </CardTitle>
                        <CardDescription>Use the lane rail to switch board context without moving the workbench.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ScrollArea className="max-h-[420px] lg:h-[calc(100vh-17rem)]">
                          <div className="space-y-3 px-6 pb-6">
                            {approvalLaneMeta.map((lane) => {
                              const Icon = lane.icon;
                              const isActive = approvalSubTab === lane.key;
                              return (
                                <button
                                  key={lane.key}
                                  onClick={() => setApprovalSubTab(lane.key)}
                                  className={`w-full rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${
                                    isActive
                                      ? `${lane.surface} shadow-sm ring-1 ring-slate-300/40 dark:ring-slate-600/40`
                                      : 'border-slate-200/70 bg-slate-50/70 hover:border-slate-300 hover:bg-white dark:border-slate-700/40 dark:bg-slate-900/60 dark:hover:bg-slate-900'
                                  }`}
                                  data-testid={`approval-lane-${lane.key}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${lane.accent} text-white shadow-sm`}>
                                        <Icon className="h-4 w-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{lane.label}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{lane.hint}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-xl font-semibold text-slate-950 dark:text-white">{lane.count}</div>
                                      <div className="text-[11px] text-muted-foreground">open</div>
                                    </div>
                                  </div>
                                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3 text-[11px] text-muted-foreground dark:border-slate-800/80">
                                    <Badge variant="outline" className={lane.chip}>{lane.sla}</Badge>
                                    <span>{Math.min(100, Math.round((lane.count / Math.max(totalPendingApprovals, 1)) * 100))}% of queue</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>

                  <div ref={approvalContentRef} className="relative z-0 min-w-0 space-y-4 scroll-mt-28">
                    <div className={`rounded-[28px] border p-5 shadow-sm ${activeApprovalLane.surface}`}>
                      <div className="flex flex-col gap-4 border-b border-slate-200/70 pb-4 dark:border-slate-800/80 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${activeApprovalLane.accent} text-white shadow-sm`}>
                            <activeApprovalLane.icon className="h-5 w-5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Decision workbench</p>
                            <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{activeApprovalLane.label}</h3>
                            <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">{activeApprovalLane.hint}</p>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[360px]">
                          <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-950/50">
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Open items</div>
                            <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{activeApprovalLane.count}</div>
                          </div>
                          <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-950/50">
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Board target</div>
                            <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{activeApprovalLane.sla}</div>
                          </div>
                          <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-950/50">
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Queue share</div>
                            <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{activeApprovalLaneShare}%</div>
                          </div>
                        </div>
                      </div>
                      {approvalSubTab === 'conversion' && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button className="gap-2 bg-slate-900 text-white hover:bg-slate-800" size="sm" onClick={() => setCreateProjectDialogOpen(true)} data-testid="button-open-pmo-create-project-conversion">
                            <Plus className="h-4 w-4" />
                            Add Project
                          </Button>
                          <p className="self-center text-xs text-muted-foreground">Create a governed project request directly from the PMO pipeline.</p>
                        </div>
                      )}
                    </div>

                    {/* Brain Decision Spine Lane */}
                    {approvalSubTab === 'brain' && (
                      <Card className="overflow-hidden border border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/75">
                        <CardHeader className="border-b border-slate-200/60 bg-[linear-gradient(180deg,rgba(236,254,255,0.92),rgba(240,253,244,0.82))] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(8,47,73,0.36),rgba(15,23,42,0.78))]">
                          <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                            Corevia Brain governance gates
                          </CardTitle>
                          <CardDescription>
                            PMO Director approval queue for Layer 7 Decision Spine decisions that cannot be auto-approved by policy.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5 p-5">
                          {(brainApprovalsLoading || pendingBrainApprovalsLoading) && (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          {!brainApprovalsLoading && !pendingBrainApprovalsLoading && pendingBrainApprovals.length === 0 && (
                            <div className="rounded-xl border border-dashed border-cyan-200 bg-cyan-50/60 py-12 text-center dark:border-cyan-500/20 dark:bg-cyan-500/10">
                              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
                              <h3 className="mb-2 text-lg font-semibold">No Brain gates waiting</h3>
                              <p className="text-muted-foreground">Layer 7 has no PMO Director approvals pending right now.</p>
                            </div>
                          )}
                          {!brainApprovalsLoading && !pendingBrainApprovalsLoading && pendingBrainApprovals.length > 0 && (
                            <ScrollArea className="max-h-[620px] pr-2">
                              <div className="space-y-4">
                                {pendingBrainApprovals.map((item) => (
                                  <div key={item.id} className="rounded-2xl border border-cyan-200/70 bg-white/95 p-5 shadow-sm transition hover:border-cyan-300/80 dark:border-cyan-500/20 dark:bg-slate-950/70" data-testid={`brain-approval-${item.reportId || item.decisionId}`}>
                                    <div className="grid gap-5 xl:grid-cols-[1fr_230px]">
                                      <div className="min-w-0 space-y-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <h4 className="max-w-full truncate text-lg font-semibold text-slate-950 dark:text-white">{item.title}</h4>
                                          <Badge variant="secondary">Pending PMO Director</Badge>
                                          <Badge variant="outline" className="border-cyan-500/20 text-cyan-700 dark:text-cyan-300">
                                            {item.layer ? `Layer ${item.layer}` : "Layer 7"}
                                          </Badge>
                                          {item.layerName && <Badge variant="outline">{item.layerName}</Badge>}
                                        </div>

                                        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                                          <div className="rounded-xl bg-slate-50/80 p-3 dark:bg-slate-900/60">
                                            <div className="text-[11px] uppercase tracking-wide">{item.reportId ? "Demand" : "Approval"}</div>
                                            <div className="mt-1 font-medium text-slate-800 dark:text-slate-100">{item.projectId || item.reportId?.slice(0, 8) || item.id.replace(/^approval:/, "").slice(0, 12)}</div>
                                          </div>
                                          <div className="rounded-xl bg-slate-50/80 p-3 dark:bg-slate-900/60">
                                            <div className="text-[11px] uppercase tracking-wide">Decision Spine</div>
                                            <div className="mt-1 truncate font-medium text-slate-800 dark:text-slate-100">{item.decisionSpineId || item.decisionId}</div>
                                          </div>
                                          <div className="rounded-xl bg-slate-50/80 p-3 dark:bg-slate-900/60">
                                            <div className="text-[11px] uppercase tracking-wide">Classification</div>
                                            <div className="mt-1 font-medium capitalize text-slate-800 dark:text-slate-100">{item.classification}</div>
                                          </div>
                                          <div className="rounded-xl bg-slate-50/80 p-3 dark:bg-slate-900/60">
                                            <div className="text-[11px] uppercase tracking-wide">Budget</div>
                                            <div className="mt-1 font-medium text-slate-800 dark:text-slate-100">{item.budget}</div>
                                          </div>
                                        </div>

                                        <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 dark:border-cyan-500/20 dark:bg-cyan-500/10">
                                          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-900 dark:text-cyan-100">
                                            <ShieldAlert className="h-4 w-4" />
                                            Why the Brain needs human approval
                                          </div>
                                          <ul className="space-y-1 text-sm text-cyan-950/80 dark:text-cyan-100/80">
                                            {item.reasons.map((reason, index) => (
                                              <li key={`${item.id}-reason-${index}`} className="flex gap-2">
                                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600 dark:bg-cyan-300" />
                                                <span>{reason}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>

                                      <div className="flex flex-col gap-2 xl:items-stretch">
                                        <Button
                                          variant="outline"
                                          className="justify-start gap-2"
                                          disabled={!item.reportId}
                                          onClick={() => item.reportId && setLocation(`/demand-analysis/${item.reportId}?tab=demand-info`)}
                                          data-testid={`button-open-brain-demand-${item.reportId || item.decisionId}`}
                                        >
                                          <FileText className="h-4 w-4" />
                                          {item.reportId ? "Open Demand" : "Brain Gate Only"}
                                        </Button>
                                        <div className="my-1 border-t border-slate-200/70 dark:border-slate-800/80" />
                                        {/* Single canonical decision control — primary Approve action with
                                            an inline split-menu for the alternative verdicts (Revise / Reject).
                                            The PMO Director only ever sees ONE button; advanced outcomes are
                                            one click away inside the chevron menu. */}
                                        <div className="flex items-stretch gap-0">
                                          <Button
                                            size="lg"
                                            className="flex-1 justify-center gap-2 rounded-r-none bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                            disabled={!canRecordBrainApproval || brainApprovalMutation.isPending}
                                            onClick={() => brainApprovalMutation.mutate({ item, action: "approve" })}
                                            data-testid={`button-approve-brain-${item.reportId || item.decisionId}`}
                                          >
                                            <CheckCircle2 className="h-4 w-4" />
                                            Approve Gate
                                          </Button>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button
                                                size="lg"
                                                className="rounded-l-none border-l border-emerald-700/40 bg-emerald-600 px-2 text-white hover:bg-emerald-700"
                                                disabled={!canRecordBrainApproval || brainApprovalMutation.isPending}
                                                aria-label="More approval actions"
                                                data-testid={`button-approve-brain-more-${item.reportId || item.decisionId}`}
                                              >
                                                <ChevronDown className="h-4 w-4" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56">
                                              <DropdownMenuItem
                                                disabled={!canRecordBrainApproval || brainApprovalMutation.isPending}
                                                onClick={() => brainApprovalMutation.mutate({ item, action: "revise" })}
                                                data-testid={`menu-revise-brain-${item.reportId || item.decisionId}`}
                                              >
                                                <ClipboardList className="mr-2 h-4 w-4" />
                                                Request Revision
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem
                                                disabled={!canRecordBrainApproval || brainApprovalMutation.isPending}
                                                onClick={() => brainApprovalMutation.mutate({ item, action: "reject" })}
                                                className="text-red-700 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300"
                                                data-testid={`menu-reject-brain-${item.reportId || item.decisionId}`}
                                              >
                                                <XCircle className="mr-2 h-4 w-4" />
                                                Reject Gate
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                        {!canRecordBrainApproval && (
                                          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                                            PMO Director role is required to record the Decision Spine approval.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Conversion Lane */}
                    {approvalSubTab === 'conversion' && (
                <Card className="overflow-hidden border border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/75">
                  <CardHeader className="border-b border-slate-200/60 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.82))] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.78))]">
                    <CardTitle className="flex items-center gap-2">
                      <Send className="h-5 w-5 text-slate-700" />
                      {t('pmo.office.conversionRequests')}
                    </CardTitle>
                    <CardDescription>
                      {t('pmo.office.conversionRequestsDesc')}
                    </CardDescription>
                  </CardHeader>
              <CardContent className="space-y-5 p-5">
                {requestsLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!requestsLoading && pendingRequests.length === 0 && (
                  <div className="text-center py-12 rounded-xl border border-dashed border-slate-200 bg-slate-50/60">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">{t('pmo.office.allCaughtUp')}</h3>
                    <p className="text-muted-foreground">{t('pmo.office.noPendingConversions')}</p>
                    <Button className="mt-4 gap-2" onClick={() => setCreateProjectDialogOpen(true)} data-testid="button-open-pmo-create-project-empty">
                      <Plus className="h-4 w-4" />
                      Add Project
                    </Button>
                  </div>
                )}
                {!requestsLoading && pendingRequests.length > 0 && (
                  <ScrollArea className="max-h-[560px] pr-2">
                    <div className="space-y-4">
                      {pendingRequests.map((request) => (
                        <div key={request.id} className="rounded-2xl border border-slate-200/70 bg-white/95 p-5 shadow-sm transition hover:border-slate-300/80 dark:border-slate-700/40 dark:bg-slate-950/70" data-testid={`approval-request-${request.id}`}>
                          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                            <div className="min-w-0 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-semibold truncate max-w-full">{request.projectName}</h4>
                                <Badge variant={request.status === 'pending' ? 'secondary' : 'default'}>
                                  {request.status === 'pending' ? t('pmo.office.pendingReview') : t('pmo.office.underReview')}
                                </Badge>
                                <Badge variant="outline" className="capitalize border-slate-200 text-slate-700">{request.priority}</Badge>
                              </div>

                              {request.projectDescription && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {request.projectDescription}
                                </p>
                              )}

                              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                                {request.proposedBudget && (
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4" />
                                    AED {Number.parseFloat(request.proposedBudget).toLocaleString()}
                                  </div>
                                )}
                                {request.proposedEndDate && (
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Target: {new Date(request.proposedEndDate).toLocaleDateString()}
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4" />
                                  Submitted: {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'Pending'}
                                </div>
                                {request.requestedByName && (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    By: {request.requestedByName}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-start gap-2 lg:flex-col lg:items-end lg:justify-start lg:min-w-[160px]">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setViewDetailsDialogOpen(true);
                                }}
                                data-testid={`button-view-${request.id}`}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setRejectDialogOpen(true);
                                }}
                                data-testid={`button-reject-${request.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setApproveDialogOpen(true);
                                }}
                                data-testid={`button-approve-${request.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
                </Card>
                  )}

                  {/* WBS Lane */}
                  {approvalSubTab === 'wbs' && (
                <Card className="overflow-hidden border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/75">
              <CardHeader className="border-b border-slate-200/60 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(245,243,255,0.88))] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(30,27,75,0.38),rgba(15,23,42,0.78))]">
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-violet-600" />
                  {t('pmo.office.wbsApprovals')}
                </CardTitle>
                <CardDescription>
                  {t('pmo.office.wbsApprovalsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                {wbsApprovalsLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!wbsApprovalsLoading && pendingWbsApprovals.length === 0 && (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">{t('pmo.office.allWbsCaughtUp')}</h3>
                    <p className="text-muted-foreground">{t('pmo.office.noPendingWbs')}</p>
                  </div>
                )}
                {!wbsApprovalsLoading && pendingWbsApprovals.length > 0 && (
                  <ScrollArea className="max-h-[560px] pr-2">
                  <div className="space-y-4">
                    {pendingWbsApprovals.map((wbs) => (
                      <div key={wbs.id} className="rounded-2xl border border-slate-200/70 bg-white/95 p-5 shadow-sm transition hover:border-slate-300/80 dark:border-slate-700/40 dark:bg-slate-950/70" data-testid={`wbs-approval-${wbs.id}`}>
                        <div className="space-y-4">
                          {/* Header Row */}
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-lg">{wbs.project_name || 'Unnamed Project'}</h4>
                            <Badge variant="secondary">Pending Review</Badge>
                            <Badge variant="outline">Version {wbs.version}</Badge>
                          </div>

                          {/* Notes */}
                          {wbs.submission_notes && (
                            <p className="rounded-xl bg-slate-50/80 p-3 text-sm text-muted-foreground dark:bg-slate-900/60">
                              <span className="font-medium">Submission Notes:</span> {wbs.submission_notes}
                            </p>
                          )}

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            {wbs.project_department && (
                              <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 p-2.5 dark:bg-slate-900/60">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span>{wbs.project_department}</span>
                              </div>
                            )}
                            {wbs.task_snapshot && (
                              <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 p-2.5 dark:bg-slate-900/60">
                                <Layers className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{Array.isArray(wbs.task_snapshot) ? wbs.task_snapshot.length : 0}</span>
                                <span>Tasks</span>
                              </div>
                            )}
                            {wbs.submitted_at && (
                              <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 p-2.5 dark:bg-slate-900/60">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{new Date(wbs.submitted_at).toLocaleDateString()}</span>
                              </div>
                            )}
                            {wbs.submitter_name && (
                              <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 p-2.5 dark:bg-slate-900/60">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span>{wbs.submitter_name}</span>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-end gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-800/80">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedWbsApproval(wbs);
                                setWbsRejectDialogOpen(true);
                              }}
                              data-testid={`button-reject-wbs-${wbs.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedWbsApproval(wbs);
                                setWbsApproveDialogOpen(true);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700"
                              data-testid={`button-approve-wbs-${wbs.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve & Lock WBS
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  </ScrollArea>
                )}
                  </CardContent>
                </Card>
                )}

                {/* Risk Register Lane */}
                {approvalSubTab === 'risks' && (
                <Card className="overflow-hidden border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/75">
                  <CardHeader className="border-b border-slate-200/60 bg-[linear-gradient(180deg,rgba(254,242,242,0.95),rgba(254,226,226,0.82))] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(127,29,29,0.24),rgba(15,23,42,0.78))]">
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-rose-600" />
                      Risk Register Approvals
                    </CardTitle>
                    <CardDescription>
                      Review the planning-phase risk register baseline submitted by project managers. Approval locks it as the risk baseline for execution.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    {riskApprovalsLoading && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {!riskApprovalsLoading && pendingRiskApprovals.length === 0 && (
                      <div className="text-center py-12">
                        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No pending risk registers</h3>
                        <p className="text-muted-foreground">All submitted risk registers have been reviewed.</p>
                      </div>
                    )}
                    {!riskApprovalsLoading && pendingRiskApprovals.length > 0 && (
                      <ScrollArea className="max-h-[560px] pr-2">
                        <div className="space-y-4">
                          {pendingRiskApprovals.map((risk) => (
                            <div key={risk.projectId} className="rounded-2xl border border-slate-200/70 bg-white/95 p-5 shadow-sm transition hover:border-slate-300/80 dark:border-slate-700/40 dark:bg-slate-950/70" data-testid={`risk-approval-${risk.projectId}`}>
                              <div className="space-y-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-semibold text-lg">{risk.projectName || 'Unnamed Project'}</h4>
                                  <Badge variant="secondary">Pending Review</Badge>
                                  <Badge variant="outline">Version {risk.version}</Badge>
                                </div>
                                {risk.submissionNotes && (
                                  <p className="rounded-xl bg-slate-50/80 p-3 text-sm text-muted-foreground dark:bg-slate-900/60">
                                    <span className="font-medium">Submission Notes:</span> {risk.submissionNotes}
                                  </p>
                                )}
                                {risk.stats && (
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                                    <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 p-2.5 dark:bg-slate-900/60">
                                      <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">{risk.stats.total}</span>
                                      <span>Risks</span>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                                      <span className="font-medium">{risk.stats.critical}</span>
                                      <span>Critical</span>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-xl bg-orange-50 p-2.5 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                                      <span className="font-medium">{risk.stats.high}</span>
                                      <span>High</span>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                      <span className="font-medium">{risk.stats.medium}</span>
                                      <span>Medium</span>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                      <span className="font-medium">{risk.stats.low}</span>
                                      <span>Low</span>
                                    </div>
                                  </div>
                                )}
                                {risk.submittedAt && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" />
                                    Submitted {new Date(risk.submittedAt).toLocaleString()}
                                    {risk.stats && <span>· {risk.stats.categoriesCovered} categor{risk.stats.categoriesCovered === 1 ? 'y' : 'ies'} covered</span>}
                                  </div>
                                )}
                                <div className="flex items-center justify-end gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-800/80">
                                  <Button
                                    variant="outline"
                                    onClick={() => { setSelectedRiskApproval(risk); setRiskRejectDialogOpen(true); }}
                                    data-testid={`button-reject-risk-${risk.projectId}`}
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Return for Revision
                                  </Button>
                                  <Button
                                    onClick={() => { setSelectedRiskApproval(risk); setRiskApproveDialogOpen(true); }}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    data-testid={`button-approve-risk-${risk.projectId}`}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Approve Baseline
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
                )}

                {/* Gates Lane */}
                {approvalSubTab === 'gates' && (
                <>
                <Card className="overflow-hidden border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/75">
                  <CardHeader className="border-b border-slate-200/60 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,247,237,0.86))] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(120,53,15,0.24),rgba(15,23,42,0.78))]">
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-amber-600" />
                      {t('pmo.office.phaseGateApprovals')}
                    </CardTitle>
                    <CardDescription>
                      {t('pmo.office.phaseGateApprovalsDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    {gateApprovalsLoading && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {!gateApprovalsLoading && pendingGateApprovals.length === 0 && (
                      <div className="text-center py-12">
                        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">{t('pmo.office.allGatesReviewed')}</h3>
                        <p className="text-muted-foreground">{t('pmo.office.noPendingGates')}</p>
                      </div>
                    )}
                    {!gateApprovalsLoading && pendingGateApprovals.length > 0 && (
                      <ScrollArea className="max-h-[560px] pr-2">
                      <div className="space-y-4">
                        {pendingGateApprovals.map((gate) => (
                          <div key={gate.id} className="rounded-2xl border border-slate-200/70 bg-white/95 p-5 shadow-sm transition hover:border-slate-300/80 dark:border-slate-700/40 dark:bg-slate-950/70" data-testid={`gate-approval-${gate.id}`}>
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-semibold text-lg">{gate.project_name || 'Project'}</h4>
                                <Badge variant="secondary">Pending Review</Badge>
                                <Badge variant="outline" className="capitalize">{gate.gate_type} Gate</Badge>
                              </div>

                              {gate.description && (
                                <p className="rounded-xl bg-slate-50/80 p-3 text-sm text-muted-foreground dark:bg-slate-900/60">
                                  {gate.description}
                                </p>
                              )}

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                {gate.department && (
                                  <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 p-2.5 dark:bg-slate-900/60">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <span>{gate.department}</span>
                                  </div>
                                )}
                                {gate.planned_date && (
                                  <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 p-2.5 dark:bg-slate-900/60">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span>{new Date(gate.planned_date).toLocaleDateString()}</span>
                                  </div>
                                )}
                                {gate.created_at && (
                                  <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 p-2.5 dark:bg-slate-900/60">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span>Submitted: {new Date(gate.created_at).toLocaleDateString()}</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-end gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-800/80">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedGateApproval(gate);
                                    setGateRejectDialogOpen(true);
                                  }}
                                  data-testid={`button-reject-gate-${gate.id}`}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                                <Button
                                  onClick={() => {
                                    setSelectedGateApproval(gate);
                                    setGateApproveDialogOpen(true);
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  data-testid={`button-approve-gate-${gate.id}`}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Approve Gate
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>

                </>
                )}
                {approvalSubTab === 'change-requests' && (
                <Card className="overflow-hidden border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/75">
                  <CardHeader className="border-b border-slate-200/60 bg-[linear-gradient(180deg,rgba(245,243,255,0.95),rgba(248,250,252,0.86))] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(76,29,149,0.18),rgba(15,23,42,0.78))]">
                    <CardTitle className="flex items-center gap-2">
                      <GitPullRequest className="h-5 w-5 text-purple-500" />
                      {t('pmo.office.changeControlRegister')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
                      <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 text-center dark:border-slate-700/40 dark:bg-slate-900/60">
                        <ClipboardList className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                        <div className="text-lg font-bold">{changeRequests.length}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                      <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-3 text-center dark:border-amber-500/20 dark:bg-amber-500/10">
                        <Hourglass className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                        <div className="text-lg font-bold text-amber-400">{pendingChangeRequests.length}</div>
                        <div className="text-xs text-muted-foreground">Pending Review</div>
                      </div>
                      <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-3 text-center dark:border-emerald-500/20 dark:bg-emerald-500/10">
                        <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
                        <div className="text-lg font-bold text-emerald-400">{changeRequests.filter(cr => cr.status === 'approved').length}</div>
                        <div className="text-xs text-muted-foreground">Approved</div>
                      </div>
                      <div className="rounded-2xl border border-rose-200/70 bg-rose-50/80 p-3 text-center dark:border-rose-500/20 dark:bg-rose-500/10">
                        <XCircle className="w-5 h-5 mx-auto text-red-500 mb-1" />
                        <div className="text-lg font-bold text-red-400">{changeRequests.filter(cr => cr.status === 'rejected').length}</div>
                        <div className="text-xs text-muted-foreground">Rejected</div>
                      </div>
                      <div className="rounded-2xl border border-sky-200/70 bg-sky-50/80 p-3 text-center dark:border-sky-500/20 dark:bg-sky-500/10">
                        <ClipboardCheck className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                        <div className="text-lg font-bold text-blue-400">{changeRequests.filter(cr => cr.status === 'implemented').length}</div>
                        <div className="text-xs text-muted-foreground">Implemented</div>
                      </div>
                    </div>

                    <ScrollArea className="h-[400px]">
                      {changeRequests.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground/70">
                          <GitPullRequest className="w-12 h-12 mx-auto mb-4 opacity-30" />
                          <p>{t('pmo.office.noChangeRequests')}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {changeRequests.map((cr) => (
                            <button
                              type="button"
                              key={cr.id}
                              className={`text-left w-full p-4 rounded-lg border hover-elevate ${(() => {
                                if (cr.status === 'approved') return 'bg-emerald-900/10 border-emerald-700/30';
                                if (cr.status === 'rejected') return 'bg-red-900/10 border-red-700/30';
                                if (cr.status === 'under_review' || cr.status === 'submitted') return 'bg-amber-900/10 border-amber-700/30';
                                return 'bg-muted/40 border-border/50';
                              })()}`}
                              onClick={() => {
                                setSelectedChangeRequest(cr);
                                setCrDetailSheetOpen(true);
                              }}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="font-mono text-xs">{cr.code}</Badge>
                                    <span className="font-medium">{cr.title}</span>
                                    <Badge className={`text-xs ${(() => {
                                      if (cr.changeType === 'timeline') return 'bg-blue-500/20 text-blue-400';
                                      if (cr.changeType === 'scope') return 'bg-purple-500/20 text-purple-400';
                                      if (cr.changeType === 'budget') return 'bg-green-500/20 text-green-400';
                                      if (cr.changeType === 'resource') return 'bg-orange-500/20 text-orange-400';
                                      return 'bg-muted text-muted-foreground';
                                    })()}`}>
                                      {cr.changeType}
                                    </Badge>
                                    <Badge className={`text-xs ${(() => {
                                      if (cr.impact === 'critical') return 'bg-red-500/20 text-red-400';
                                      if (cr.impact === 'high') return 'bg-orange-500/20 text-orange-400';
                                      if (cr.impact === 'medium') return 'bg-amber-500/20 text-amber-400';
                                      return 'bg-muted text-muted-foreground';
                                    })()}`}>
                                      {cr.impact} impact
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{cr.description}</p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                                    <span className="flex items-center gap-1">
                                      <Briefcase className="w-3 h-3" />
                                      {cr.projectName}
                                    </span>
                                    <span>Requested: {new Date(cr.requestedAt).toLocaleDateString()}</span>
                                    {cr.estimatedScheduleImpact !== 0 && (
                                      <span className="flex items-center gap-1">
                                        <CalendarDays className="w-3 h-3" />
                                        {cr.estimatedScheduleImpact > 0 ? '+' : ''}{cr.estimatedScheduleImpact} days
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge className={`${(() => {
                                    if (cr.status === 'approved') return 'bg-emerald-500/20 text-emerald-400';
                                    if (cr.status === 'rejected') return 'bg-red-500/20 text-red-400';
                                    if (cr.status === 'under_review' || cr.status === 'submitted') return 'bg-amber-500/20 text-amber-400';
                                    if (cr.status === 'implemented') return 'bg-blue-500/20 text-blue-400';
                                    return 'bg-muted text-muted-foreground';
                                  })()}`}>
                                    {cr.status.replaceAll('_', ' ')}
                                  </Badge>
                                  {(cr.status === 'submitted' || cr.status === 'under_review') && (
                                    <div className="flex items-center gap-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-emerald-600 gap-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedChangeRequest(cr);
                                          setCrDetailSheetOpen(true);
                                        }}
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-red-600 gap-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedChangeRequest(cr);
                                          setCrDetailSheetOpen(true);
                                        }}
                                      >
                                        <XCircle className="w-3 h-3" />
                                        Reject
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
                )}
                  </div>

                </div>
              </TabsContent>

              <TabsContent value="governance" className="space-y-6">

                {/* ── Governance Command Header ── */}
                <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 dark:border-slate-700/40">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/[0.04] via-transparent to-transparent" />
                  <div className="relative px-6 py-5">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-foreground tracking-tight">Governance Command Center</h2>
                        <p className="text-xs text-muted-foreground">Enterprise governance posture and control effectiveness</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                      {/* Governance Readiness */}
                      <div className="group relative rounded-xl border border-emerald-200/60 bg-white/80 dark:bg-slate-900/60 dark:border-emerald-500/20 p-4 transition-all hover:shadow-md hover:border-emerald-300/80">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-[10px] font-medium uppercase tracking-widest text-emerald-600/80 dark:text-emerald-400/80">Governance Readiness</div>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500/60" />
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold tabular-nums text-foreground">{governanceReadinessScore}</span>
                          <span className="text-sm text-muted-foreground mb-1">/ 100</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700" style={{ width: `${governanceReadinessScore}%` }} />
                        </div>
                      </div>

                      {/* Value Realization */}
                      <div className="group relative rounded-xl border border-blue-200/60 bg-white/80 dark:bg-slate-900/60 dark:border-blue-500/20 p-4 transition-all hover:shadow-md hover:border-blue-300/80">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-[10px] font-medium uppercase tracking-widest text-blue-600/80 dark:text-blue-400/80">Value Realization</div>
                          <TrendingUp className="h-4 w-4 text-blue-500/60" />
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold tabular-nums text-foreground">{valueRealizationScore}</span>
                          <span className="text-sm text-muted-foreground mb-1">%</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700" style={{ width: `${valueRealizationScore}%` }} />
                        </div>
                      </div>

                      {/* Approval Pressure */}
                      <div className="group relative rounded-xl border border-amber-200/60 bg-white/80 dark:bg-slate-900/60 dark:border-amber-500/20 p-4 transition-all hover:shadow-md hover:border-amber-300/80">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-[10px] font-medium uppercase tracking-widest text-amber-600/80 dark:text-amber-400/80">Approval Pressure</div>
                          <Flame className="h-4 w-4 text-amber-500/60" />
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold tabular-nums text-foreground">{approvalPressureScore}</span>
                          <span className="text-sm text-muted-foreground mb-1">/ 100</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${(() => {
                            if (approvalPressureScore > 70) return 'bg-gradient-to-r from-red-500 to-amber-500';
                            if (approvalPressureScore > 40) return 'bg-gradient-to-r from-amber-500 to-amber-400';
                            return 'bg-gradient-to-r from-emerald-500 to-emerald-400';
                          })()}`} style={{ width: `${approvalPressureScore}%` }} />
                        </div>
                      </div>

                      {/* Portfolio Drag */}
                      <div className="group relative rounded-xl border border-rose-200/60 bg-white/80 dark:bg-slate-900/60 dark:border-rose-500/20 p-4 transition-all hover:shadow-md hover:border-rose-300/80">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-[10px] font-medium uppercase tracking-widest text-rose-600/80 dark:text-rose-400/80">Portfolio Drag</div>
                          <TrendingDown className="h-4 w-4 text-rose-500/60" />
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold tabular-nums text-foreground">{portfolioDragIndex}</span>
                          <span className="text-sm text-muted-foreground mb-1">index</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${(() => {
                            if (portfolioDragIndex > 60) return 'bg-gradient-to-r from-rose-600 to-rose-400';
                            if (portfolioDragIndex > 30) return 'bg-gradient-to-r from-amber-500 to-amber-400';
                            return 'bg-gradient-to-r from-emerald-500 to-emerald-400';
                          })()}`} style={{ width: `${Math.min(portfolioDragIndex, 100)}%` }} />
                        </div>
                      </div>

                      {/* Evidence Review */}
                      <Link href="/quality-assurance">
                        <div className={`group relative rounded-xl border ${qaPendingEvidence > 0 ? 'border-cyan-300/80 dark:border-cyan-500/30' : 'border-cyan-200/60 dark:border-cyan-500/20'} bg-white/80 dark:bg-slate-900/60 p-4 transition-all hover:shadow-md hover:border-cyan-400/80 cursor-pointer`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-[10px] font-medium uppercase tracking-widest text-cyan-600/80 dark:text-cyan-400/80">Evidence Review</div>
                            <FileCheck className="h-4 w-4 text-cyan-500/60" />
                          </div>
                          <div className="flex items-end gap-2">
                            <span className={`text-3xl font-bold tabular-nums ${qaPendingEvidence > 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-foreground'}`}>{qaPendingEvidence}</span>
                            <span className="text-sm text-muted-foreground mb-1">pending</span>
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{qaApprovedEvidence} approved</span>
                            {qaRejectedEvidence > 0 && <span className="text-red-600 dark:text-red-400 font-medium">{qaRejectedEvidence} rejected</span>}
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* ── Governance Domain Pillars ── */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-sm font-semibold text-foreground tracking-tight">Governance Domains</h3>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[
                      {
                        title: t('pmo.office.govDemandIntake'),
                        description: t('pmo.office.govDemandIntakeDesc'),
                        icon: Inbox,
                        link: '/demand-intake',
                        accent: 'from-sky-500 to-blue-600',
                        border: 'border-sky-200/60 hover:border-sky-300/80 dark:border-sky-500/20',
                        iconBg: 'bg-sky-500/10',
                        iconColor: 'text-sky-600 dark:text-sky-400',
                        status: 'active' as const,
                        metrics: [
                          { label: 'Pending', value: pendingDemandCount },
                          { label: 'Approved', value: approvedDemandCount },
                        ],
                        testId: 'card-demand-intake',
                      },
                      {
                        title: t('pmo.office.govProjectApproval'),
                        description: t('pmo.office.govProjectApprovalDesc'),
                        icon: ClipboardList,
                        link: '/project-approval',
                        accent: 'from-violet-500 to-purple-600',
                        border: 'border-violet-200/60 hover:border-violet-300/80 dark:border-violet-500/20',
                        iconBg: 'bg-violet-500/10',
                        iconColor: 'text-violet-600 dark:text-violet-400',
                        status: 'review' as const,
                        metrics: [
                          { label: 'Pending', value: pendingRequests.length },
                          { label: 'Under review', value: conversionCounts.underReview },
                        ],
                        testId: 'card-project-approval',
                      },
                      {
                        title: t('pmo.office.govRiskManagement'),
                        description: t('pmo.office.govRiskManagementDesc'),
                        icon: AlertTriangle,
                        link: '/risk-management',
                        accent: 'from-amber-500 to-orange-600',
                        border: 'border-amber-200/60 hover:border-amber-300/80 dark:border-amber-500/20',
                        iconBg: 'bg-amber-500/10',
                        iconColor: 'text-amber-600 dark:text-amber-400',
                        status: 'active' as const,
                        metrics: [
                          { label: 'At risk', value: healthBreakdown.at_risk },
                          { label: 'Critical', value: healthBreakdown.critical },
                        ],
                        testId: 'card-risk-management',
                      },
                      {
                        title: t('pmo.office.govResourceAllocation'),
                        description: t('pmo.office.govResourceAllocationDesc'),
                        icon: Users,
                        link: '/resource-allocation',
                        accent: 'from-emerald-500 to-teal-600',
                        border: 'border-emerald-200/60 hover:border-emerald-300/80 dark:border-emerald-500/20',
                        iconBg: 'bg-emerald-500/10',
                        iconColor: 'text-emerald-600 dark:text-emerald-400',
                        status: 'active' as const,
                        metrics: [
                          { label: 'Utilization', value: `${portfolioUtilization}%` },
                          { label: 'Budget used', value: `${budgetUtilization}%` },
                        ],
                        testId: 'card-resource-allocation',
                      },
                      {
                        title: t('pmo.office.govComplianceTracking'),
                        description: t('pmo.office.govComplianceTrackingDesc'),
                        icon: Scale,
                        link: '/compliance-tracking',
                        accent: 'from-rose-500 to-pink-600',
                        border: 'border-rose-200/60 hover:border-rose-300/80 dark:border-rose-500/20',
                        iconBg: 'bg-rose-500/10',
                        iconColor: 'text-rose-600 dark:text-rose-400',
                        status: 'active' as const,
                        metrics: [
                          { label: 'Alerts', value: insightAlerts },
                          { label: 'Gaps', value: insightCriticalGaps },
                        ],
                        testId: 'card-compliance',
                      },
                      {
                        title: t('pmo.office.govPerformanceReporting'),
                        description: t('pmo.office.govPerformanceReportingDesc'),
                        icon: BarChart3,
                        link: '/performance-reporting',
                        accent: 'from-indigo-500 to-blue-600',
                        border: 'border-indigo-200/60 hover:border-indigo-300/80 dark:border-indigo-500/20',
                        iconBg: 'bg-indigo-500/10',
                        iconColor: 'text-indigo-600 dark:text-indigo-400',
                        status: 'active' as const,
                        metrics: [
                          { label: 'Health', value: `${portfolioHealth}%` },
                          { label: 'Active', value: portfolioActive },
                        ],
                        testId: 'card-performance',
                      },
                      {
                        title: t('pmo.office.govQualityAssurance'),
                        description: t('pmo.office.govQualityAssuranceDesc'),
                        icon: Shield,
                        link: '/quality-assurance',
                        accent: 'from-cyan-500 to-teal-600',
                        border: 'border-cyan-200/60 hover:border-cyan-300/80 dark:border-cyan-500/20',
                        iconBg: 'bg-cyan-500/10',
                        iconColor: 'text-cyan-600 dark:text-cyan-400',
                        status: qaPendingEvidence > 0 ? 'review' as const : 'active' as const,
                        metrics: [
                          { label: 'Pending', value: qaPendingEvidence },
                          { label: 'Approved', value: qaApprovedEvidence },
                          { label: 'Evidence', value: qaTotalEvidence },
                        ],
                        testId: 'card-quality-assurance',
                      },
                    ].map((pillar) => {
                      const PillarIcon = pillar.icon;
                      return (
                        <Link key={pillar.testId} href={pillar.link}>
                          <Card className={`group relative overflow-hidden cursor-pointer h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${pillar.border} bg-white/90 dark:bg-slate-900/70`} data-testid={pillar.testId}>
                            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${pillar.accent}`} />
                            <CardContent className="p-5">
                              <div className="flex items-start gap-3.5">
                                <div className={`h-10 w-10 rounded-xl ${pillar.iconBg} flex items-center justify-center shrink-0`}>
                                  <PillarIcon className={`h-5 w-5 ${pillar.iconColor}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-sm font-semibold text-foreground leading-tight">{pillar.title}</h4>
                                    <div className={`h-2 w-2 rounded-full shrink-0 ${(() => {
                                      if (pillar.status === 'active') return 'bg-emerald-500';
                                      if (pillar.status === 'review') return 'bg-amber-500';
                                      return 'bg-slate-400';
                                    })()}`} />
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{pillar.description}</p>
                                  <div className="flex gap-3">
                                    {pillar.metrics.map((m) => (
                                      <div key={m.label} className="flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1">
                                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</span>
                                        <span className="text-xs font-bold text-foreground">{typeof m.value === 'number' ? m.value.toLocaleString() : m.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* ── Governance Posture + Risk Intelligence ── */}
                <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
                  {/* Posture Dashboard */}
                  <Card className="border-slate-200/60 bg-white/90 dark:bg-slate-900/70 dark:border-slate-700/40">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Sparkles className="h-5 w-5 text-amber-500" />
                          {t('pmo.office.governanceSnapshot')}
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          {portfolioTotal} projects governed
                        </Badge>
                      </div>
                      <CardDescription>{t('pmo.office.governanceSnapshotDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {/* Control effectiveness row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border/50 bg-gradient-to-b from-muted/20 to-muted/40 p-3.5">
                          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Conversion rate</div>
                          <div className="text-xl font-bold tabular-nums text-foreground">{conversionSuccessRate}%</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{conversionTotal} pipeline demands</div>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-gradient-to-b from-muted/20 to-muted/40 p-3.5">
                          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Gate readiness</div>
                          <div className="text-xl font-bold tabular-nums text-foreground">{averageGateReadiness}%</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{gateHistory.length} reviews</div>
                        </div>
                      </div>

                      {/* Portfolio health distribution */}
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">Portfolio health distribution</div>
                        <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                          {healthMix.onTrack > 0 && <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${healthMix.onTrack}%` }} title={`On track: ${healthBreakdown.on_track}`} />}
                          {healthMix.atRisk > 0 && <div className="bg-amber-500 transition-all duration-500" style={{ width: `${healthMix.atRisk}%` }} title={`At risk: ${healthBreakdown.at_risk}`} />}
                          {healthMix.critical > 0 && <div className="bg-rose-500 transition-all duration-500" style={{ width: `${healthMix.critical}%` }} title={`Critical: ${healthBreakdown.critical}`} />}
                        </div>
                        <div className="flex justify-between mt-2">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] text-muted-foreground">On track {healthBreakdown.on_track}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-amber-500" />
                            <span className="text-[10px] text-muted-foreground">At risk {healthBreakdown.at_risk}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-rose-500" />
                            <span className="text-[10px] text-muted-foreground">Critical {healthBreakdown.critical}</span>
                          </div>
                        </div>
                      </div>

                      {/* Key metrics grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="text-center p-2.5 rounded-lg bg-muted/30">
                          <div className="text-lg font-bold tabular-nums text-foreground">{totalPendingApprovals}</div>
                          <div className="text-[10px] text-muted-foreground">Pending approvals</div>
                        </div>
                        <div className="text-center p-2.5 rounded-lg bg-muted/30">
                          <div className="text-lg font-bold tabular-nums text-foreground">{portfolioActive}</div>
                          <div className="text-[10px] text-muted-foreground">Active projects</div>
                        </div>
                        <div className="text-center p-2.5 rounded-lg bg-muted/30">
                          <div className="text-lg font-bold tabular-nums text-foreground">{budgetUtilization}%</div>
                          <div className="text-[10px] text-muted-foreground">Budget utilized</div>
                        </div>
                        <div className="text-center p-2.5 rounded-lg bg-muted/30">
                          <div className="text-lg font-bold tabular-nums text-foreground">{portfolioCompleted}</div>
                          <div className="text-[10px] text-muted-foreground">Completed</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                </div>

                {/* ── Recent Governance Activity Timeline ── */}
                <Card className="border-slate-200/60 bg-white/90 dark:bg-slate-900/70 dark:border-slate-700/40">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Clock className="h-5 w-5 text-emerald-500" />
                        {t('pmo.office.recentGovernanceActivity')}
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px]">{governanceActivity.length} events</Badge>
                    </div>
                    <CardDescription>{t('pmo.office.recentGovernanceActivityDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {governanceActivity.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                          <Clock className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                        <div className="text-sm text-muted-foreground">{t('pmo.office.noRecentGovernanceActivity')}</div>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border/60" />
                        <div className="space-y-1">
                          {governanceActivity.map((item, idx) => {
                            let statusColor = 'bg-amber-500';
                            if (item.status === 'approved' || item.status === 'passed') statusColor = 'bg-emerald-500';
                            else if (item.status === 'rejected') statusColor = 'bg-rose-500';
                            return (
                              <div key={`${item.type}-${idx}`} className="relative flex items-start gap-4 py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors group">
                                <div className={`relative z-10 mt-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${statusColor} shrink-0`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
                                    <Badge
                                      variant={(() => {
                                        if (item.status === 'approved' || item.status === 'passed') return 'default' as const;
                                        if (item.status === 'rejected') return 'destructive' as const;
                                        return 'secondary' as const;
                                      })()}
                                      className="text-[10px] shrink-0"
                                    >
                                      {(item.status || 'pending').replaceAll('_', ' ')}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] text-muted-foreground">{item.type}</span>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="text-[11px] text-muted-foreground">{item.detail}</span>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="text-[11px] text-muted-foreground">{item.at ? new Date(item.at).toLocaleDateString() : 'Pending'}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── Capacity & Resource Planning (merged from Capacity tab) ── */}
                <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
                  <Card className="border-amber-200/40 bg-white/80 dark:bg-slate-900/70">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-amber-600" />
                        {t('pmo.office.capacityUtilization')}
                      </CardTitle>
                      <CardDescription>{t('pmo.office.capacityUtilizationDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Utilization</div>
                          <div className="text-lg font-semibold text-slate-900">{portfolioUtilization}%</div>
                        </div>
                        <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Budget</div>
                          <div className="text-lg font-semibold text-slate-900">AED {Math.round(portfolioBudget).toLocaleString()}</div>
                        </div>
                        <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Spend</div>
                          <div className="text-lg font-semibold text-slate-900">AED {Math.round(portfolioSpend).toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Budget burn</span>
                          <span className="font-medium">
                            {portfolioBudget > 0 ? Math.round((portfolioSpend / portfolioBudget) * 100) : 0}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-amber-100">
                          <div
                            className="h-2 rounded-full bg-amber-500"
                            style={{ width: `${portfolioBudget > 0 ? Math.min(100, Math.round((portfolioSpend / portfolioBudget) * 100)) : 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Utilization rate</span>
                          <span className="font-medium">{portfolioUtilization}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-amber-100">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${portfolioUtilization}%` }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-6">
                    <Card className="border-amber-200/40 bg-white/80 dark:bg-slate-900/70">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Layers className="h-5 w-5 text-amber-600" />
                          {t('pmo.office.phaseLoad')}
                        </CardTitle>
                        <CardDescription>{t('pmo.office.phaseLoadDesc')}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {Object.keys(phaseBreakdown).length === 0 ? (
                          <div className="text-sm text-muted-foreground">{t('pmo.office.noPhaseDataAvailable')}</div>
                        ) : (
                          Object.entries(phaseBreakdown).map(([phase, count]) => (
                            <div key={phase} className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/60 p-3">
                              <span className="text-sm font-medium capitalize text-slate-900">{phase.replaceAll('_', ' ')}</span>
                              <Badge variant="secondary">{Number(count)}</Badge>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-amber-200/40 bg-white/80 dark:bg-slate-900/70">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-amber-600" />
                          {t('pmo.office.healthDistribution')}
                        </CardTitle>
                        <CardDescription>{t('pmo.office.healthDistributionDesc')}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {[
                          { label: t('pmo.office.onTrack'), value: healthBreakdown.on_track, color: "bg-emerald-500" },
                          { label: t('pmo.office.atRisk'), value: healthBreakdown.at_risk, color: "bg-amber-500" },
                          { label: t('pmo.office.critical'), value: healthBreakdown.critical, color: "bg-rose-500" },
                        ].map((item) => (
                          <div key={item.label} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className="font-medium text-slate-900">{item.value}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted">
                              <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${portfolioTotal > 0 ? Math.round((item.value / portfolioTotal) * 100) : 0}%` }} />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>

              </TabsContent>

              <TabsContent value="standards" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
              <Card className="border-amber-200/40 bg-white/80 dark:bg-slate-900/70">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <BookOpen className="h-5 w-5 text-amber-600" />
                    <span>{t('pmo.office.standardsLibrary')}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      onClick={() => setPmoUploadDialogOpen(true)}
                      data-testid="button-open-pmo-upload"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {t('pmo.office.uploadPmoStandard')}
                    </Button>
                  </CardTitle>
                  <CardDescription>{t('pmo.office.standardsLibraryDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('pmo.office.documents')}</div>
                      <div className="text-lg font-semibold text-slate-900">{pmoTotal.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('pmo.office.processed')}</div>
                      <div className="text-lg font-semibold text-slate-900">{pmoProcessed.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pending</div>
                      <div className="text-lg font-semibold text-slate-900">{pmoPending.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {[
                      { key: "Guidelines", description: t('pmo.office.classGuidelinesDesc') },
                      { key: "Process", description: t('pmo.office.classProcessDesc') },
                      { key: "Policies", description: t('pmo.office.classPoliciesDesc') },
                      { key: "Research", description: t('pmo.office.classResearchDesc') },
                    ].map((section) => {
                      const docs = pmoDocsByClass[section.key] || [];
                      return (
                        <div key={section.key} className="rounded-xl border border-amber-100 bg-white/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">{section.key}</div>
                              <div className="text-[11px] text-muted-foreground">{section.description}</div>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">
                              {docs.length.toLocaleString()}
                            </Badge>
                          </div>
                          <div className="mt-3 space-y-2">
                            <PMOKnowledgeDocList docs={docs} t={t} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-6">
                <Card className="border-amber-200/40 bg-white/80 dark:bg-slate-900/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-amber-600" />
                      {t('pmo.office.policyComplianceWatch')}
                    </CardTitle>
                    <CardDescription>{t('pmo.office.governanceReadinessDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('pmo.office.healthScore')}</div>
                        <div className="text-lg font-semibold text-slate-900">{insightHealthScore}%</div>
                      </div>
                      <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('pmo.office.activeAlertsLabel')}</div>
                        <div className="text-lg font-semibold text-slate-900">{insightAlerts}</div>
                      </div>
                      <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('pmo.office.criticalGapsLabel')}</div>
                        <div className="text-lg font-semibold text-slate-900">{insightCriticalGaps}</div>
                      </div>
                      <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('pmo.office.unassigned')}</div>
                        <div className="text-lg font-semibold text-slate-900">{pmoUnassigned.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-amber-100 bg-white/70 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('pmo.office.topCategories')}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(pmoCategoryCounts).length === 0 ? (
                          <span className="text-xs text-muted-foreground">{t('pmo.office.noCategoriesAvailable')}</span>
                        ) : (
                          Object.entries(pmoCategoryCounts).slice(0, 6).map(([key, value]) => (
                            <Badge key={key} variant="secondary" className="capitalize">
                              {key} • {Number(value)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('pmo.office.latestUpload', { label: pmoLatestLabel })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
              </TabsContent>

              <Suspense fallback={null}>
                <PMOOfficeUploadDialog
                  open={pmoUploadDialogOpen}
                  onOpenChange={setPmoUploadDialogOpen}
                  pmoUploadInputKey={pmoUploadInputKey}
                  pmoUploadFile={pmoUploadFile}
                  onPmoUploadFileChange={setPmoUploadFile}
                  pmoUploadClassification={pmoUploadClassification}
                  onPmoUploadClassificationChange={setPmoUploadClassification}
                  pmoUploadCategory={pmoUploadCategory}
                  onPmoUploadCategoryChange={setPmoUploadCategory}
                  pmoUploadTags={pmoUploadTags}
                  onPmoUploadTagsChange={setPmoUploadTags}
                  pmoUploadAccess={pmoUploadAccess}
                  onPmoUploadAccessChange={setPmoUploadAccess}
                  onSubmit={() => pmoUploadMutation.mutate()}
                  submitPending={pmoUploadMutation.isPending}
                />
              </Suspense>

              <PmoCreateProjectDialog
                open={createProjectDialogOpen}
                onOpenChange={setCreateProjectDialogOpen}
                pipelineItems={pipelineItems}
                onConfirm={(data) => createProjectMutation.mutate(data)}
                isPending={createProjectMutation.isPending}
              />

              </div>
          </div>

          {/* ── Evidence Review Sheet (slide-over drawer) ── */}
          <Sheet open={evidencePanelOpen} onOpenChange={(open) => {
            setEvidencePanelOpen(open);
            if (!open) setEvidencePanelDismissed(true);
          }}>
            <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
              <SheetHeader className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 space-y-4 bg-gradient-to-b from-slate-50/80 to-white dark:from-slate-900/50 dark:to-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <SheetTitle className="text-base font-semibold">Evidence Review</SheetTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {qaProjects.length} project{qaProjects.length !== 1 ? "s" : ""} · {qaTotalEvidence} evidence file{qaTotalEvidence !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20">
                      <Clock className="h-3 w-3 text-amber-500" />
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{qaPendingEvidence}</span>
                      <span className="text-[10px] text-amber-500/80">pending</span>
                    </div>
                  </div>
                </div>

                {/* Summary stats strip */}
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { label: "Total", value: qaTotalEvidence, icon: Upload, bg: "bg-slate-100 dark:bg-slate-800", iconColor: "text-slate-500", valueColor: "text-slate-700 dark:text-slate-300" },
                    { label: "Pending", value: qaPendingEvidence, icon: Clock, bg: "bg-amber-50 dark:bg-amber-500/10", iconColor: "text-amber-500", valueColor: "text-amber-700 dark:text-amber-400" },
                    { label: "Approved", value: qaApprovedEvidence, icon: CheckCircle2, bg: "bg-emerald-50 dark:bg-emerald-500/10", iconColor: "text-emerald-500", valueColor: "text-emerald-700 dark:text-emerald-400" },
                    { label: "Rejected", value: qaRejectedEvidence, icon: XCircle, bg: "bg-red-50 dark:bg-red-500/10", iconColor: "text-red-500", valueColor: "text-red-700 dark:text-red-400" },
                  ] as const).map((stat) => (
                    <div key={stat.label} className={`flex flex-col items-center py-2 rounded-lg ${stat.bg}`}>
                      <stat.icon className={`h-3.5 w-3.5 ${stat.iconColor} mb-0.5`} />
                      <span className={`text-sm font-bold ${stat.valueColor}`}>{stat.value}</span>
                      <span className="text-[9px] text-muted-foreground">{stat.label}</span>
                    </div>
                  ))}
                </div>

                {/* Filter tabs */}
                <div className="flex gap-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-lg p-0.5">
                  {(["all", "pending", "approved", "rejected"] as const).map((f) => {
                    const count = f === 'all' ? qaTotalEvidence : f === 'pending' ? qaPendingEvidence : f === 'approved' ? qaApprovedEvidence : qaRejectedEvidence;
                    return (
                      <button
                        key={f}
                        onClick={() => setEvidenceFilter(f)}
                        className={`flex-1 px-2 py-1.5 text-[10px] rounded-md font-medium transition-all ${
                          evidenceFilter === f
                            ? "bg-white dark:bg-slate-700 text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="capitalize">{f}</span>
                        <span className={`ml-1 ${evidenceFilter === f ? "text-foreground" : "text-muted-foreground/60"}`}>({count})</span>
                      </button>
                    );
                  })}
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div>
                  <PMOEvidenceList
                    qaProjects={qaProjects}
                    evidenceFilter={evidenceFilter}
                    evidenceVerifyIsPending={evidenceVerifyMutation.isPending}
                    evidenceVerifyMutate={evidenceVerifyMutation.mutate}
                    evidenceVerifyingId={evidenceVerifyingId}
                    evidenceVerifyNotes={evidenceVerifyNotes}
                    evidencePreviewTask={evidencePreviewTask}
                    setEvidencePreviewTask={setEvidencePreviewTask}
                    updateEvidenceNote={updateEvidenceNote}
                    clearEvidenceNote={clearEvidenceNote}
                    setEvidenceVerifyingId={setEvidenceVerifyingId}
                  />
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          </div>{/* close flex flex-1 min-h-0 */}
          </div>{/* close flex-col h-full w-full */}
          </Tabs>

      <Suspense fallback={null}>
        <PMOOfficeApprovalDialogs
          approveDialogOpen={approveDialogOpen}
          onApproveDialogOpenChange={setApproveDialogOpen}
          selectedRequest={selectedRequestDialogData}
          decisionNotes={decisionNotes}
          onDecisionNotesChange={setDecisionNotes}
          onApproveCancel={() => {
            setApproveDialogOpen(false);
            setSelectedRequest(null);
            setDecisionNotes("");
          }}
          onApproveConfirm={() => {
            if (selectedRequest) {
              approveMutation.mutate({ id: selectedRequest.id, notes: decisionNotes });
            }
          }}
          approvePending={approveMutation.isPending}
          rejectDialogOpen={rejectDialogOpen}
          onRejectDialogOpenChange={setRejectDialogOpen}
          rejectionReason={rejectionReason}
          onRejectionReasonChange={setRejectionReason}
          onRejectCancel={() => {
            setRejectDialogOpen(false);
            setSelectedRequest(null);
            setRejectionReason("");
            setDecisionNotes("");
          }}
          onRejectConfirm={() => {
            if (selectedRequest && rejectionReason.trim()) {
              rejectMutation.mutate({
                id: selectedRequest.id,
                reason: rejectionReason,
                notes: decisionNotes,
              });
            }
          }}
          rejectPending={rejectMutation.isPending}
          wbsApproveDialogOpen={wbsApproveDialogOpen}
          onWbsApproveDialogOpenChange={setWbsApproveDialogOpen}
          selectedWbsApproval={selectedWbsApprovalDialogData}
          wbsReviewNotes={wbsReviewNotes}
          onWbsReviewNotesChange={setWbsReviewNotes}
          onWbsApproveCancel={() => {
            setWbsApproveDialogOpen(false);
            setSelectedWbsApproval(null);
            setWbsReviewNotes("");
          }}
          onWbsApproveConfirm={() => {
            if (selectedWbsApproval) {
              approveWbsMutation.mutate({ id: selectedWbsApproval.id, notes: wbsReviewNotes });
            }
          }}
          approveWbsPending={approveWbsMutation.isPending}
          wbsRejectDialogOpen={wbsRejectDialogOpen}
          onWbsRejectDialogOpenChange={setWbsRejectDialogOpen}
          wbsRejectionReason={wbsRejectionReason}
          onWbsRejectionReasonChange={setWbsRejectionReason}
          onWbsRejectCancel={() => {
            setWbsRejectDialogOpen(false);
            setSelectedWbsApproval(null);
            setWbsRejectionReason("");
            setWbsReviewNotes("");
          }}
          onWbsRejectConfirm={() => {
            if (selectedWbsApproval && wbsRejectionReason.trim()) {
              rejectWbsMutation.mutate({
                id: selectedWbsApproval.id,
                reason: wbsRejectionReason,
                notes: wbsReviewNotes,
              });
            }
          }}
          rejectWbsPending={rejectWbsMutation.isPending}
          gateApproveDialogOpen={gateApproveDialogOpen}
          onGateApproveDialogOpenChange={setGateApproveDialogOpen}
          selectedGateApproval={selectedGateApprovalDialogData}
          gateReviewNotes={gateReviewNotes}
          onGateReviewNotesChange={setGateReviewNotes}
          onGateApproveCancel={() => {
            setGateApproveDialogOpen(false);
            setSelectedGateApproval(null);
            setGateReviewNotes("");
          }}
          onGateApproveConfirm={() => {
            if (selectedGateApproval) {
              approveGateMutation.mutate({ id: selectedGateApproval.id, notes: gateReviewNotes });
            }
          }}
          approveGatePending={approveGateMutation.isPending}
          gateRejectDialogOpen={gateRejectDialogOpen}
          onGateRejectDialogOpenChange={setGateRejectDialogOpen}
          gateRejectionReason={gateRejectionReason}
          onGateRejectionReasonChange={setGateRejectionReason}
          onGateRejectCancel={() => {
            setGateRejectDialogOpen(false);
            setSelectedGateApproval(null);
            setGateRejectionReason("");
            setGateReviewNotes("");
          }}
          onGateRejectConfirm={() => {
            if (selectedGateApproval && gateRejectionReason.trim()) {
              rejectGateMutation.mutate({
                id: selectedGateApproval.id,
                reason: gateRejectionReason,
                notes: gateReviewNotes,
              });
            }
          }}
          rejectGatePending={rejectGateMutation.isPending}
        />
      </Suspense>

      <Suspense fallback={null}>
        <PMOOfficeRiskDialogs
          approveOpen={riskApproveDialogOpen}
          onApproveOpenChange={setRiskApproveDialogOpen}
          rejectOpen={riskRejectDialogOpen}
          onRejectOpenChange={setRiskRejectDialogOpen}
          selectedRiskApproval={selectedRiskApproval}
          reviewNotes={riskReviewNotes}
          onReviewNotesChange={setRiskReviewNotes}
          rejectionReason={riskRejectionReason}
          onRejectionReasonChange={setRiskRejectionReason}
          approvePending={approveRiskMutation.isPending}
          rejectPending={rejectRiskMutation.isPending}
          onApproveCancel={() => {
            setRiskApproveDialogOpen(false);
            setSelectedRiskApproval(null);
            setRiskReviewNotes("");
          }}
          onApproveConfirm={() => {
            if (selectedRiskApproval) {
              approveRiskMutation.mutate({ projectId: selectedRiskApproval.projectId, notes: riskReviewNotes });
            }
          }}
          onRejectCancel={() => {
            setRiskRejectDialogOpen(false);
            setSelectedRiskApproval(null);
            setRiskRejectionReason("");
            setRiskReviewNotes("");
          }}
          onRejectConfirm={() => {
            if (selectedRiskApproval && riskRejectionReason.trim()) {
              rejectRiskMutation.mutate({ projectId: selectedRiskApproval.projectId, reason: riskRejectionReason, notes: riskReviewNotes });
            }
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <PMOChangeRequestDetailSheet
          open={crDetailSheetOpen}
          onOpenChange={(open) => {
            setCrDetailSheetOpen(open);
            if (!open) {
              setSelectedChangeRequest(null);
              setCrImplementationNotes("");
            }
          }}
          selectedChangeRequest={selectedChangeRequest}
          crProjectTasks={crProjectTasks}
          crReviewNotes={crReviewNotes}
          onCrReviewNotesChange={setCrReviewNotes}
          crImplementationNotes={crImplementationNotes}
          onCrImplementationNotesChange={setCrImplementationNotes}
          onApprove={() => {
            if (selectedChangeRequest) {
              approveCrMutation.mutate({ id: selectedChangeRequest.id, notes: crReviewNotes });
            }
          }}
          onOpenReject={() => {
            setCrDetailSheetOpen(false);
            setCrRejectDialogOpen(true);
          }}
          onImplement={() => {
            if (selectedChangeRequest) {
              implementCrMutation.mutate({ id: selectedChangeRequest.id, notes: crImplementationNotes });
            }
          }}
          approvePending={approveCrMutation.isPending}
          implementPending={implementCrMutation.isPending}
        />
      </Suspense>

      <Suspense fallback={null}>
        <PMOOfficeReviewDialogs
          crApproveDialogOpen={crApproveDialogOpen}
          onCrApproveDialogOpenChange={setCrApproveDialogOpen}
          selectedChangeRequest={selectedChangeRequest}
          crReviewNotes={crReviewNotes}
          onCrReviewNotesChange={setCrReviewNotes}
          onCrApproveCancel={() => {
            setCrApproveDialogOpen(false);
            setSelectedChangeRequest(null);
            setCrReviewNotes("");
          }}
          onCrApproveConfirm={() => {
            if (selectedChangeRequest) {
              approveCrMutation.mutate({ id: selectedChangeRequest.id, notes: crReviewNotes });
            }
          }}
          approveCrPending={approveCrMutation.isPending}
          crRejectDialogOpen={crRejectDialogOpen}
          onCrRejectDialogOpenChange={setCrRejectDialogOpen}
          crRejectionReason={crRejectionReason}
          onCrRejectionReasonChange={setCrRejectionReason}
          onCrRejectCancel={() => {
            setCrRejectDialogOpen(false);
            setSelectedChangeRequest(null);
            setCrRejectionReason("");
            setCrReviewNotes("");
          }}
          onCrRejectConfirm={() => {
            if (selectedChangeRequest && crRejectionReason.trim()) {
              rejectCrMutation.mutate({ id: selectedChangeRequest.id, reason: crRejectionReason });
            }
          }}
          rejectCrPending={rejectCrMutation.isPending}
          viewDetailsDialogOpen={viewDetailsDialogOpen}
          onViewDetailsDialogOpenChange={setViewDetailsDialogOpen}
          selectedRequest={selectedRequestDetails}
          onCloseDetails={() => setViewDetailsDialogOpen(false)}
          onOpenRejectFromDetails={() => {
            setViewDetailsDialogOpen(false);
            setRejectDialogOpen(true);
          }}
          onOpenApproveFromDetails={() => {
            setViewDetailsDialogOpen(false);
            setApproveDialogOpen(true);
          }}
        />
      </Suspense>
      </div>
    );

  return renderContent();
  }
