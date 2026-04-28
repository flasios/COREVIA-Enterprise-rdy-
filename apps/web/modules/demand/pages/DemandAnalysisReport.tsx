import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuthorization } from "@/hooks/useAuthorization";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { DemandField } from "@/modules/demand";
// Lazy load heavy components for better initial load performance
const BusinessCaseTab = lazy(() => import("@/modules/demand/components/tabs/BusinessCaseTab"));
const DetailedRequirementsTab = lazy(() => import("@/modules/demand/components/tabs/DetailedRequirementsTab"));
const EnterpriseArchitectureTab = lazy(async () => ({
  default: (await import("@/modules/ea")).EnterpriseArchitectureTab,
}));
const StrategicFitTab = lazy(async () => ({
  default: (await import("@/modules/demand")).StrategicFitTab,
}));
import { VideoLogo } from "@/components/ui/video-logo";
import {
  ArrowLeft, FileText, Shield, XCircle, Calendar, Maximize, Minimize,
  Loader2, Clock, Briefcase, Target, TrendingUp, AlertTriangle,
  Send, Info, MessageSquare, Landmark, ShieldCheck,
} from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";

// Extracted sub-modules
import type { DemandReport, ReportVersion, VersionsApiResponse, WorkflowUpdateData, WorkflowError } from "./demandAnalysisReport.types";
import { getBrainStatus, resolveDemandDisplayWorkflowStatus } from "./demandAnalysisReport.utils";
import { BrainRibbon } from "./demandAnalysisReport.BrainRibbon";
import { VersionManagementHeader } from "./demandAnalysisReport.WorkflowTimeline";
import { DemandInfoHeader } from "./demandAnalysisReport.DemandInfoHeader";
import { SmartResourcePanel } from "./demandAnalysisReport.SmartResourcePanel";
import { WorkflowPanel } from "./demandAnalysisReport.WorkflowPanel";
import { ArtifactLifecyclePanel } from "./demandAnalysisReport.ArtifactLifecyclePanel";

const TAB_ALIASES: Record<string, string> = {
  'demand-information': 'demand-info',
  'business-case': 'business-case',
  'detailed-requirements': 'requirements',
  'enterprise-architecture': 'ea',
  'strategic-fit': 'strategic-fit',
};

function normalizeReportTab(tab: string | null): string {
  switch (tab) {
    case 'demand-information':
    case 'demand-info':
    case 'demand':
      return 'demand-information';
    case 'business-case':
    case 'businesscase':
    case 'bc':
      return 'business-case';
    case 'detailed-requirements':
    case 'requirements':
    case 'requirement':
    case 'req':
      return 'detailed-requirements';
    case 'enterprise-architecture':
    case 'ea':
    case 'architecture':
      return 'enterprise-architecture';
    case 'strategic-fit':
    case 'strategicfit':
    case 'fit':
      return 'strategic-fit';
    default:
      return 'demand-information';
  }
}

function formatConfidencePercent(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const normalized = value > 100 ? value / 100 : value > 1 ? value : value * 100;
  const bounded = Math.max(0, Math.min(100, normalized));
  return `${Math.round(bounded)}%`;
}

function resolveBrainNextGate(coreviaPreApproved: boolean, workflowStatus?: string | null, fallback?: string): string {
  if (!coreviaPreApproved) return fallback || "Review";
  if (workflowStatus === "deferred") return "Human workflow deferred";
  if (workflowStatus === "rejected") return "Human workflow rejected";
  return "Human acknowledgement";
}

function resolveInitialReportTab(): string {
  if (globalThis.window === undefined) {
    return 'demand-information';
  }

  const url = new URL(globalThis.window.location.href);
  return normalizeReportTab(url.searchParams.get('tab'));
}

function resolveCurrentBrowserUrl(fallbackLocation: string): URL {
  if (globalThis.window !== undefined) {
    return new URL(globalThis.window.location.href);
  }

  return new URL(fallbackLocation, 'http://localhost');
}

function resolveAccessibleReportTab(
  requestedTab: string | null,
  access: {
    canAccessBusinessCase: boolean;
    canAccessRequirements: boolean;
    canAccessEnterpriseArchitecture: boolean;
    canAccessStrategicFit: boolean;
  },
): string {
  const normalizedTab = normalizeReportTab(requestedTab);
  if (normalizedTab === 'business-case' && !access.canAccessBusinessCase) return 'demand-information';
  if (normalizedTab === 'detailed-requirements' && !access.canAccessRequirements) return 'demand-information';
  if (normalizedTab === 'enterprise-architecture' && !access.canAccessEnterpriseArchitecture) return 'demand-information';
  if (normalizedTab === 'strategic-fit' && !access.canAccessStrategicFit) return 'demand-information';
  return normalizedTab;
}

const MAXIMIZABLE_TABS = new Set(['business-case', 'detailed-requirements', 'enterprise-architecture', 'strategic-fit']);

interface TabAccessFlags {
  canAccessBusinessCase: boolean;
  canAccessRequirements: boolean;
  canAccessEnterpriseArchitecture: boolean;
  canAccessStrategicFit: boolean;
}

function BusinessCaseSectionFallback({ onOpenDemandInfo }: Readonly<{ onOpenDemandInfo: () => void }>) {
  return (
    <div className="flex min-h-[24rem] items-center justify-center p-6">
      <Card className="w-full max-w-2xl border-amber-500/30 bg-card/95">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden="true" />
          </div>
          <CardTitle>Business Case Temporarily Unavailable</CardTitle>
          <p className="text-sm text-muted-foreground">
            Data for this section is not available right now. Continue with the rest of the report or refresh the page to reload the business case.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={onOpenDemandInfo}>
            Open Demand Information
          </Button>
          <Button onClick={() => globalThis.window?.location.reload()}>
            Refresh Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function LockedWorkflowGate({ title, message }: Readonly<{ title: string; message?: string }>) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-xl border border-amber-200 bg-amber-50/70 p-6 text-center dark:border-amber-800 dark:bg-amber-950/20">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
          <ShieldCheck className="h-6 w-6 text-amber-700 dark:text-amber-300" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title} is locked</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {message || "Corevia Brain is waiting at Layer 7. A reviewer must acknowledge the Brain reasons in Demand Information before this analysis can be opened."}
        </p>
      </div>
    </div>
  );
}

function MaximizedTabTriggers({ access }: Readonly<{ access: TabAccessFlags }>) {
  return (
    <>
      <TabsTrigger
        value="demand-information"
        className="relative overflow-hidden text-sm font-semibold gap-2 h-14 rounded-xl border-2 transition-all duration-300 data-[state=active]:border-blue-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500/10 data-[state=active]:to-blue-600/10 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=inactive]:border-muted data-[state=inactive]:hover:border-blue-300 dark:data-[state=inactive]:hover:border-blue-700 data-[state=inactive]:hover:bg-blue-500/5"
        data-testid="tab-demand-information"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 data-[state=active]:animate-shimmer" />
        <div className="relative flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <span className="hidden sm:inline">Demand Information</span>
          <div className="h-2 w-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
        </div>
      </TabsTrigger>
      {access.canAccessBusinessCase ? (
      <TabsTrigger
        value="business-case"
        className="relative overflow-hidden text-sm font-semibold gap-2 h-14 rounded-xl border-2 transition-all duration-300 data-[state=active]:border-purple-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500/10 data-[state=active]:to-purple-600/10 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400 data-[state=inactive]:border-muted data-[state=inactive]:hover:border-purple-300 dark:data-[state=inactive]:hover:border-purple-700 data-[state=inactive]:hover:bg-purple-500/5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-muted disabled:hover:bg-transparent"
        data-testid="tab-business-case"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0" />
        <div className="relative flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-md ${
            access.canAccessBusinessCase
              ? 'bg-gradient-to-br from-purple-500 to-purple-600'
              : 'bg-muted'
          }`}>
            <Briefcase className={`h-4 w-4 ${access.canAccessBusinessCase ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
          <span className="hidden sm:inline">Business Case</span>
        </div>
      </TabsTrigger>
      ) : null}
      {access.canAccessRequirements ? (
      <TabsTrigger
        value="detailed-requirements"
        className="relative overflow-hidden text-sm font-semibold gap-2 h-14 rounded-xl border-2 transition-all duration-300 data-[state=active]:border-amber-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500/10 data-[state=active]:to-amber-600/10 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400 data-[state=inactive]:border-muted data-[state=inactive]:hover:border-amber-300 dark:data-[state=inactive]:hover:border-amber-700 data-[state=inactive]:hover:bg-amber-500/5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-muted disabled:hover:bg-transparent"
        data-testid="tab-detailed-requirements"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0" />
        <div className="relative flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-md ${
            access.canAccessRequirements
              ? 'bg-gradient-to-br from-amber-500 to-amber-600'
              : 'bg-muted'
          }`}>
            <Target className={`h-4 w-4 ${access.canAccessRequirements ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
          <span className="hidden sm:inline">Requirements</span>
        </div>
      </TabsTrigger>
      ) : null}
      {access.canAccessEnterpriseArchitecture ? (
      <TabsTrigger
        value="enterprise-architecture"
        className="relative overflow-hidden text-sm font-semibold gap-2 h-14 rounded-xl border-2 transition-all duration-300 data-[state=active]:border-cyan-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-cyan-500/10 data-[state=active]:to-cyan-600/10 data-[state=active]:text-cyan-700 dark:data-[state=active]:text-cyan-400 data-[state=inactive]:border-muted data-[state=inactive]:hover:border-cyan-300 dark:data-[state=inactive]:hover:border-cyan-700 data-[state=inactive]:hover:bg-cyan-500/5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-muted disabled:hover:bg-transparent"
        data-testid="tab-enterprise-architecture"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0" />
        <div className="relative flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-md ${
            access.canAccessEnterpriseArchitecture
              ? 'bg-gradient-to-br from-cyan-500 to-cyan-600'
              : 'bg-muted'
          }`}>
            <Landmark className={`h-4 w-4 ${access.canAccessEnterpriseArchitecture ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
          <span className="hidden sm:inline">EA</span>
        </div>
      </TabsTrigger>
      ) : null}
      {access.canAccessStrategicFit ? (
      <TabsTrigger
        value="strategic-fit"
        className="relative overflow-hidden text-sm font-semibold gap-2 h-14 rounded-xl border-2 transition-all duration-300 data-[state=active]:border-emerald-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500/10 data-[state=active]:to-emerald-600/10 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 data-[state=inactive]:border-muted data-[state=inactive]:hover:border-emerald-300 dark:data-[state=inactive]:hover:border-emerald-700 data-[state=inactive]:hover:bg-emerald-500/5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-muted disabled:hover:bg-transparent"
        data-testid="tab-strategic-fit"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0" />
        <div className="relative flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-md ${
            access.canAccessStrategicFit
              ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
              : 'bg-muted'
          }`}>
            <TrendingUp className={`h-4 w-4 ${access.canAccessStrategicFit ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
          <span className="hidden sm:inline">Strategic Fit</span>
        </div>
      </TabsTrigger>
      ) : null}
    </>
  );
}

function CompactTabTriggers({ access }: Readonly<{ access: TabAccessFlags }>) {
  return (
    <>
      <TabsTrigger
        value="demand-information"
        className="relative overflow-hidden text-xs font-medium gap-1.5 h-9 rounded-md border transition-all duration-200 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=inactive]:border-border data-[state=inactive]:hover:border-blue-300 dark:data-[state=inactive]:hover:border-blue-700 data-[state=inactive]:hover:bg-blue-500/5"
        data-testid="tab-demand-information"
      >
        <div className="relative flex items-center gap-1.5">
          <div className="h-5 w-5 rounded bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <FileText className="h-3 w-3 text-white" />
          </div>
          <span className="hidden sm:inline">Demand Info</span>
          <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
        </div>
      </TabsTrigger>
      {access.canAccessBusinessCase ? (
      <TabsTrigger
        value="business-case"
        className="relative overflow-hidden text-xs font-medium gap-1.5 h-9 rounded-md border transition-all duration-200 data-[state=active]:border-purple-500 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400 data-[state=inactive]:border-border data-[state=inactive]:hover:border-purple-300 dark:data-[state=inactive]:hover:border-purple-700 data-[state=inactive]:hover:bg-purple-500/5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent"
        data-testid="tab-business-case"
      >
        <div className="relative flex items-center gap-1.5">
          <div className={`h-5 w-5 rounded flex items-center justify-center ${
            access.canAccessBusinessCase
              ? 'bg-gradient-to-br from-purple-500 to-purple-600'
              : 'bg-muted'
          }`}>
            <Briefcase className={`h-3 w-3 ${access.canAccessBusinessCase ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
          <span className="hidden sm:inline">Business Case</span>
        </div>
      </TabsTrigger>
      ) : null}
      {access.canAccessRequirements ? (
      <TabsTrigger
        value="detailed-requirements"
        className="relative overflow-hidden text-xs font-medium gap-1.5 h-9 rounded-md border transition-all duration-200 data-[state=active]:border-amber-500 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400 data-[state=inactive]:border-border data-[state=inactive]:hover:border-amber-300 dark:data-[state=inactive]:hover:border-amber-700 data-[state=inactive]:hover:bg-amber-500/5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent"
        data-testid="tab-detailed-requirements"
      >
        <div className="relative flex items-center gap-1.5">
          <div className={`h-5 w-5 rounded flex items-center justify-center ${
            access.canAccessRequirements
              ? 'bg-gradient-to-br from-amber-500 to-amber-600'
              : 'bg-muted'
          }`}>
            <Target className={`h-3 w-3 ${access.canAccessRequirements ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
          <span className="hidden sm:inline">Requirements</span>
        </div>
      </TabsTrigger>
      ) : null}
      {access.canAccessEnterpriseArchitecture ? (
      <TabsTrigger
        value="enterprise-architecture"
        className="relative overflow-hidden text-xs font-medium gap-1.5 h-9 rounded-md border transition-all duration-200 data-[state=active]:border-cyan-500 data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-700 dark:data-[state=active]:text-cyan-400 data-[state=inactive]:border-border data-[state=inactive]:hover:border-cyan-300 dark:data-[state=inactive]:hover:border-cyan-700 data-[state=inactive]:hover:bg-cyan-500/5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent"
        data-testid="tab-enterprise-architecture"
      >
        <div className="relative flex items-center gap-1.5">
          <div className={`h-5 w-5 rounded flex items-center justify-center ${
            access.canAccessEnterpriseArchitecture
              ? 'bg-gradient-to-br from-cyan-500 to-cyan-600'
              : 'bg-muted'
          }`}>
            <Landmark className={`h-3 w-3 ${access.canAccessEnterpriseArchitecture ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
          <span className="hidden sm:inline">EA</span>
        </div>
      </TabsTrigger>
      ) : null}
      {access.canAccessStrategicFit ? (
      <TabsTrigger
        value="strategic-fit"
        className="relative overflow-hidden text-xs font-medium gap-1.5 h-9 rounded-md border transition-all duration-200 data-[state=active]:border-emerald-500 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 data-[state=inactive]:border-border data-[state=inactive]:hover:border-emerald-300 dark:data-[state=inactive]:hover:border-emerald-700 data-[state=inactive]:hover:bg-emerald-500/5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent"
        data-testid="tab-strategic-fit"
      >
        <div className="relative flex items-center gap-1.5">
          <div className={`h-5 w-5 rounded flex items-center justify-center ${
            access.canAccessStrategicFit
              ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
              : 'bg-muted'
          }`}>
            <TrendingUp className={`h-3 w-3 ${access.canAccessStrategicFit ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
          <span className="hidden sm:inline">Strategic Fit</span>
        </div>
      </TabsTrigger>
      ) : null}
    </>
  );
}

interface DemandInfoContentProps {
  report: DemandReport;
  workflowActioned: boolean;
  id: string;
  updateWorkflowMutation: ReturnType<typeof useMutation<unknown, Error, WorkflowUpdateData>>;
  onShowSmartPanel: () => void;
  brainDecisionId: string | undefined;
  brainStatus: ReturnType<typeof getBrainStatus>;
  classification: string;
  classificationConfidence: number | null | undefined;
  decisionSource: string;
  coreviaPreApproved: boolean;
  policyApprovalPending: boolean;
  approvalReasons: string[];
  approvalRoutedToPmoDirector: boolean;
  onShowGovernance: () => void;
}

function DemandInfoContent({ report, workflowActioned, id, updateWorkflowMutation, onShowSmartPanel, brainDecisionId, brainStatus, classification, classificationConfidence, decisionSource, coreviaPreApproved, policyApprovalPending, approvalReasons, approvalRoutedToPmoDirector, onShowGovernance }: Readonly<DemandInfoContentProps>) {
  const isDirectorApproved = String(report.aiAnalysis?.directorApprovalStatus ?? "").toLowerCase() === "approved";

  return (
    <div className="space-y-6">
      <DemandInfoHeader
        report={report}
        workflowActioned={workflowActioned}
        id={id}
        updateWorkflowMutation={updateWorkflowMutation}
        onShowSmartPanel={onShowSmartPanel}
        approvalReasons={approvalReasons}
      />

      <div className="space-y-4">
        {(report.projectId || report.suggestedProjectName) ? (
          <div className="p-4 rounded-lg bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900/50 dark:to-blue-950/30 border border-slate-200 dark:border-slate-700 mb-4" data-testid="project-identification-section">
            <div className="flex flex-wrap items-center gap-4">
              {report.projectId && (
                <Badge variant="outline" className="text-sm font-mono bg-white dark:bg-slate-800" data-testid="text-project-id">
                  {report.projectId}
                </Badge>
              )}
              {report.suggestedProjectName && (
                <h3 className="text-lg font-semibold text-foreground" data-testid="text-project-name">
                  {report.suggestedProjectName}
                </h3>
              )}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DemandField label="Organization" value={report.organizationName} testId="display-organization" type="text" />
          <DemandField label="Department" value={report.department} testId="display-department" type="text" />
          <DemandField label="Requestor" value={{ primary: report.requestorName, secondary: report.requestorEmail }} testId="display-requestor" type="contact" />
          <DemandField label="Priority" value={report.urgency} testId="display-urgency" type="priority" />
          <DemandField label="Data Classification" value={report.dataClassification || 'internal'} testId="display-classification" type="classification" />
        </div>

        <Separator />
        <div className="space-y-4">
          <h4 className="font-semibold flex items-center gap-2">
            <HexagonLogoFrame px={16} />
            Business Context
          </h4>
          <div className="space-y-4">
            <DemandField label="Business Objective" value={report.businessObjective} testId="display-business-objective" type="longText" />
            <DemandField label="Expected Outcomes" value={report.expectedOutcomes} testId="display-expected-outcomes" type="longText" />
            <DemandField label="Success Criteria" value={report.successCriteria} testId="display-success-criteria" type="longText" />
          </div>
        </div>

        <Separator />
        <div className="space-y-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Resource Requirements
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DemandField label="Budget Range" value={report.budgetRange} testId="display-budget-range" type="text" />
            <DemandField label="Timeframe" value={report.timeframe} testId="display-timeframe" type="text" />
          </div>
          <DemandField label="Key Stakeholders" value={report.stakeholders} testId="display-stakeholders" type="longText" />
        </div>

        <Separator />
        <div className="space-y-4">
          <h4 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Challenges & Risk Assessment
          </h4>
          <DemandField label="Current Challenges" value={report.currentChallenges} testId="display-current-challenges" type="longText" />
          <DemandField label="Risk Factors" value={report.riskFactors} testId="display-risk-factors" type="longText" />
        </div>

        <Separator />
        <div className="space-y-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Compliance & Governance
          </h4>
          <DemandField label="Compliance Requirements" value={report.complianceRequirements} testId="display-compliance-requirements" type="longText" />
        </div>

        {brainDecisionId && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <HexagonLogoFrame px={16} />
                Corevia Brain Governance
              </h4>
              <p className="text-sm text-muted-foreground">
                Decision spine governance for this demand analysis.
              </p>
              <ArtifactLifecyclePanel
                lifecycle={report.artifactLifecycle}
                decisionSource={decisionSource}
                classification={classification}
                policyApprovalPending={policyApprovalPending}
              />
              <BrainRibbon
                brainDecisionId={brainDecisionId}
                brainStatus={brainStatus}
                classification={classification}
                classificationConfidence={classificationConfidence}
                coreviaPreApproved={coreviaPreApproved}
                isPmoDirectorApproved={isDirectorApproved}
                approvalRoutedToPmoDirector={approvalRoutedToPmoDirector}
                onShowGovernance={onShowGovernance}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FullscreenTabDialogTitle({ maximizedTab }: Readonly<{ maximizedTab: string | null }>) {
  switch (maximizedTab) {
    case 'business-case':
      return (
        <>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <Briefcase className="h-4 w-4 text-white" />
          </div>
          <span>Business Case - Full View</span>
        </>
      );
    case 'detailed-requirements':
      return (
        <>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <Target className="h-4 w-4 text-white" />
          </div>
          <span>Requirements Analysis - Full View</span>
        </>
      );
    case 'enterprise-architecture':
      return (
        <>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
            <Landmark className="h-4 w-4 text-white" />
          </div>
          <span>Enterprise Architecture - Full View</span>
        </>
      );
    case 'strategic-fit':
      return (
        <>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <span>Strategic Fit Analysis - Full View</span>
        </>
      );
    default:
      return null;
  }
}

export default function DemandAnalysisReport() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [location, setLocation] = useLocation();
  const [isMaximized, setIsMaximized] = useState(false);
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(false);
  const [workflowExpanded, setWorkflowExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState(resolveInitialReportTab);
  const [highlightSection, setHighlightSection] = useState<string | undefined>(undefined);
  const [showScheduleMeetingDialog, setShowScheduleMeetingDialog] = useState(false);
  const [showSmartPanel, setShowSmartPanel] = useState(false);
  const [maximizedTab, setMaximizedTab] = useState<'business-case' | 'detailed-requirements' | 'enterprise-architecture' | 'strategic-fit' | null>(null);
  const [showBrainGovernance, setShowBrainGovernance] = useState(false);

  const handleTabChange = (nextTab: string) => {
    setActiveTab(nextTab);

    const url = resolveCurrentBrowserUrl(location);
    const nextAlias = TAB_ALIASES[nextTab] ?? 'demand-info';

    if (url.searchParams.get('tab') !== nextAlias) {
      url.searchParams.set('tab', nextAlias);
      setLocation(`${url.pathname}${url.search}${url.hash}`);
    }
  };

  const navigateToLibrary = () => {
    setLocation('/intelligent-library?section=demands');
  };

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch demand report - SINGLE OPTIMIZED QUERY
  const { data: reportData, isLoading, error, refetch: refetchReport } = useQuery({
    queryKey: ['/api/demand-reports', id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/demand-reports/${id}`);
      const result = await response.json();

      return result;
    },
    enabled: !!id,
    staleTime: 30_000, // 30 seconds - balance between freshness and performance
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
    refetchOnWindowFocus: false, // Disabled to prevent API spam on tab switching
    refetchInterval: false
  });

  // Fetch Business Case versions to check approval status
  const { data: versionsData } = useQuery({
    queryKey: ['/api/demand-reports', id, 'versions'],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/demand-reports/${id}/versions`);
      return response.json();
    },
    enabled: !!id,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const report: DemandReport = reportData?.success ? reportData.data : null;

  // Track workflow status changes for real-time updates
  useEffect(() => {
    if (report?.workflowStatus) {
      console.log('🔄 Workflow Status Updated:', {
        reportId: id,
        workflowStatus: report.workflowStatus,
        timestamp: new Date().toISOString()
      });
    }
  }, [report?.workflowStatus, id]);

  // Memoize version approval calculations to avoid recalculating on every render
  const { businessCaseApproved, requirementsApproved, enterpriseArchitectureApproved } = useMemo(() => {
    const typedVersionsData = versionsData as VersionsApiResponse | undefined;
    const versions = typedVersionsData?.success ? typedVersionsData.data : undefined;
    if (!versions || !Array.isArray(versions) || versions.length === 0) {
      return { businessCaseApproved: false, requirementsApproved: false, enterpriseArchitectureApproved: false };
    }

    const approvedStatuses = new Set(['published']);
    return {
      businessCaseApproved: versions.some((v: ReportVersion) =>
        v.versionType === 'business_case' && approvedStatuses.has(v.status)
      ),
      requirementsApproved: versions.some((v: ReportVersion) =>
        v.versionType === 'requirements' && approvedStatuses.has(v.status)
      ),
      enterpriseArchitectureApproved: versions.some((v: ReportVersion) =>
        v.versionType === 'enterprise_architecture' && approvedStatuses.has(v.status)
      ),
    };
  }, [versionsData]);

  const actionedWorkflowStatuses = [
    'acknowledged',
    'meeting_scheduled',
    'under_review',
    'requires_more_info',
    'initially_approved',
    'approved',
    'manager_approval',
    'manager_approved',
    'pending_conversion',
    'converted',
    'completed',
  ] as const;

  const brainApprovalClosedWorkflowStatuses = [
    'deferred',
    'rejected',
  ] as const;

  const businessCasePermission = useAuthorization({ requiredPermissions: ["business-case:generate"] });
  const requirementsPermission = useAuthorization({ requiredPermissions: ["requirements:generate"] });
  const enterpriseArchitecturePermission = useAuthorization({ requiredPermissions: ["ea:generate"] });
  const strategicFitPermission = useAuthorization({ requiredPermissions: ["strategic-fit:generate"] });

  const workflowActioned = !!(report?.workflowStatus && actionedWorkflowStatuses.includes(report.workflowStatus as (typeof actionedWorkflowStatuses)[number]));
  const hasPolicyApprovalReasons = Array.isArray(report?.aiAnalysis?.approvalReasons)
    ? report.aiAnalysis.approvalReasons.some((reason: unknown) => typeof reason === "string" && reason.trim().length > 0)
    : typeof report?.aiAnalysis?.approvalReason === "string" && report.aiAnalysis.approvalReason.trim().length > 0;
  const policyApprovalRequired = Boolean(
    report?.aiAnalysis?.approvalRequired ||
    report?.aiAnalysis?.approvalStatus === "pending" ||
    report?.aiAnalysis?.finalStatus === "pending_approval" ||
    hasPolicyApprovalReasons,
  );
  const policyApprovalClosedByWorkflow = Boolean(
    report?.workflowStatus &&
    brainApprovalClosedWorkflowStatuses.includes(report.workflowStatus as (typeof brainApprovalClosedWorkflowStatuses)[number]),
  );
  const spineApprovalApproved = report?.aiAnalysis?.approvalStatus === "approved";
  const directorApprovalStatus = report?.aiAnalysis?.directorApprovalStatus || report?.aiAnalysis?.approvalStatus;
  const normalizedDirectorApprovalStatus = typeof directorApprovalStatus === "string"
    ? directorApprovalStatus.toLowerCase()
    : undefined;
  const isPmoDirectorApproved = normalizedDirectorApprovalStatus === "approved";
  const isPmoDirectorClosed = normalizedDirectorApprovalStatus === "approved"
    || normalizedDirectorApprovalStatus === "rejected"
    || normalizedDirectorApprovalStatus === "revised";
  const policyApprovalPending = Boolean(
    policyApprovalRequired &&
    !spineApprovalApproved &&
    !isPmoDirectorClosed &&
    !policyApprovalClosedByWorkflow,
  );
  const coreviaPreApproved = Boolean(
    spineApprovalApproved ||
    isPmoDirectorApproved ||
    !policyApprovalRequired,
  );
  const workflowAccessUnlocked = workflowActioned && coreviaPreApproved;

  // Business Case tab should be unlocked after workflow action is taken (super_admin bypasses this gate)
  const canAccessBusinessCase = workflowAccessUnlocked && businessCasePermission.canAccess;

  // Requirements tab should be unlocked only after demand is acknowledged
  const canAccessRequirements = workflowAccessUnlocked && requirementsPermission.canAccess;

  // EA tab follows same entry unlock as the other analytical tabs; prerequisites are enforced inside the tab.
  const canAccessEnterpriseArchitecture = workflowAccessUnlocked && enterpriseArchitecturePermission.canAccess;

  // Strategic Fit tab should be unlocked only after demand is acknowledged (like Business Case and Requirements)
  const canAccessStrategicFit = workflowAccessUnlocked && strategicFitPermission.canAccess;
  const lockedGateMessage = policyApprovalPending
    ? "Demand acknowledgement is separate and already part of the workflow. This Brain run also requires Decision Spine approval from the PMO Director before this analysis can be opened."
    : undefined;

  // Parse URL parameters and prevent locked tabs from being forced via direct URL.
  useEffect(() => {
    const url = resolveCurrentBrowserUrl(location);
    const tabFromUrl = url.searchParams.get('tab');
    const sectionFromUrl = url.searchParams.get('section');
    const normalizedRequestedTab = normalizeReportTab(tabFromUrl);

    console.log('📍 Location changed, URL Params:', { tab: tabFromUrl, section: sectionFromUrl, location });

    if (isLoading || !reportData) {
      setActiveTab((currentTab) => currentTab === normalizedRequestedTab ? currentTab : normalizedRequestedTab);

      if (sectionFromUrl) {
        console.log('🎯 Setting highlight section to:', sectionFromUrl);
        setHighlightSection(sectionFromUrl);
      }
      return;
    }

    const resolvedTab = resolveAccessibleReportTab(tabFromUrl, {
      canAccessBusinessCase,
      canAccessRequirements,
      canAccessEnterpriseArchitecture,
      canAccessStrategicFit,
    });
    setActiveTab((currentTab) => currentTab === resolvedTab ? currentTab : resolvedTab);

    const resolvedAlias = TAB_ALIASES[resolvedTab] ?? 'demand-info';
    if (url.searchParams.get('tab') !== resolvedAlias) {
      url.searchParams.set('tab', resolvedAlias);
      if (resolvedTab === 'demand-information') {
        url.searchParams.delete('autostart');
      }
      setLocation(`${url.pathname}${url.search}${url.hash}`);
      return;
    }

    if (resolvedTab === 'demand-information' && url.searchParams.has('autostart')) {
      url.searchParams.delete('autostart');
      setLocation(`${url.pathname}${url.search}${url.hash}`);
      return;
    }

    if (sectionFromUrl) {
      console.log('🎯 Setting highlight section to:', sectionFromUrl);
      setHighlightSection(sectionFromUrl);
    }
  }, [canAccessBusinessCase, canAccessEnterpriseArchitecture, canAccessRequirements, canAccessStrategicFit, isLoading, location, reportData, setLocation]);

  // Migration can be manually triggered from UI to prevent infinite loops

  // State for governance pending dialog
  const [showGovernancePendingDialog, setShowGovernancePendingDialog] = useState(false);
  const [governancePendingInfo, setGovernancePendingInfo] = useState<{
    message: string;
    demandTitle?: string;
    pendingApprovals: Array<{
      id: string;
      requestNumber: string;
      status: string;
      intent?: string;
      decisionType?: string;
      financialAmount?: number;
      regulatoryRisk?: string;
      blockReasons?: string[];
    }>;
  } | null>(null);
  const [governanceMessage, setGovernanceMessage] = useState("");
  const [sendingGovernanceMessage, setSendingGovernanceMessage] = useState(false);

  // Workflow status mutation - using fetch directly to handle 409 governance errors properly
  const updateWorkflowMutation = useMutation({
    mutationFn: async (updateData: WorkflowUpdateData) => {
      const response = await fetch(`/api/demand-reports/${id}/workflow`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
        credentials: "include",
      });

      const data = await response.json();

      // Check if response was not ok (error response)
      if (!response.ok) {
        // Throw the error data with status so onError can handle it
        const error = new Error(data.message || "Failed to update workflow") as WorkflowError;
        error.status = response.status;
        error.pendingApprovals = data.pendingApprovals;
        error.errorData = data;
        throw error;
      }

      return data;
    },
    onSuccess: async () => {
      // Force refetch to get the latest data immediately - ARRAY FORMAT!
      await queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', id] });
      await refetchReport();
      toast({
        title: t('demand.workflowUpdated'),
        description: t('demand.workflowUpdatedDesc'),
      });
    },
    onError: (error: Error) => {
      const workflowError = error as WorkflowError;
      // Check for governance pending error (409 Conflict)
      if (workflowError?.status === 409 && workflowError?.errorData?.pendingApprovals) {
        setGovernancePendingInfo({
          message: workflowError.message || "This demand has pending governance approvals that must be completed first.",
          demandTitle: workflowError.errorData.demandTitle,
          pendingApprovals: workflowError.errorData.pendingApprovals || []
        });
        setGovernanceMessage("");
        setShowGovernancePendingDialog(true);
      } else {
        toast({
          title: t('demand.workflowUpdateFailed'),
          description: workflowError?.message || t('demand.workflowUpdateFailedDesc'),
          variant: "destructive",
        });
      }
    }
  });

  const approvalRoutedToPmoDirector = report?.aiAnalysis?.directorApprovalStatus === "requested";
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background constellation-grid relative overflow-hidden">
        <div className="container mx-auto p-6 relative z-10 h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <VideoLogo size="sm" className="mx-auto" />
            <div>
              <h3 className="font-semibold">{t('demand.loadingReport')}</h3>
              <p className="text-sm text-muted-foreground">{t('demand.loadingReportDesc')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-[100dvh] bg-background constellation-grid relative overflow-hidden">
        <div className="container mx-auto p-6 relative z-10 h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="h-16 w-16 rounded-xl bg-red-500/20 flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-red-500">{t('demand.reportNotFound')}</h3>
              <p className="text-sm text-muted-foreground">{t('demand.reportNotFoundDesc')}</p>
              <Button
                onClick={navigateToLibrary}
                className="mt-4"
                data-testid="button-back-to-library"
              >
                Back to Library
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const brainDecisionId = report.aiAnalysis?.decisionId;
  const displayWorkflowStatus = resolveDemandDisplayWorkflowStatus(report.workflowStatus, report.workflowHistory);
  const approvalReasons = Array.isArray(report.aiAnalysis?.approvalReasons)
    ? report.aiAnalysis.approvalReasons.filter((reason): reason is string => typeof reason === "string" && reason.trim().length > 0)
    : typeof report.aiAnalysis?.approvalReason === "string" && report.aiAnalysis.approvalReason.trim()
      ? [report.aiAnalysis.approvalReason]
      : [];
  const brainLifecycleStatus = policyApprovalPending
    ? "pending_approval"
    : typeof report.aiAnalysis?.finalStatus === "string"
      ? report.aiAnalysis.finalStatus
      : displayWorkflowStatus;
  const brainStatus = getBrainStatus(brainLifecycleStatus);
  const classification = report.dataClassification || report.aiAnalysis?.classificationLevel || "internal";
  const classificationConfidence = report.dataClassificationConfidence ?? report.aiAnalysis?.classificationConfidence;
  const classificationConfidenceLabel = formatConfidencePercent(classificationConfidence);
  const decisionSource = report.aiAnalysis?.source || "COREVIA Brain";
  const brainNextGate = resolveBrainNextGate(coreviaPreApproved, report.workflowStatus, brainStatus.nextGate);

  // Full screen mode
  if (isMaximized) {
    return (
      <div className="min-h-[100dvh] bg-background constellation-grid relative overflow-hidden">
        <div className="relative z-10 h-full flex flex-col">
          <VersionManagementHeader
            report={report}
            workflowStatus={displayWorkflowStatus}
            workflowExpanded={workflowExpanded}
            setWorkflowExpanded={setWorkflowExpanded}
            showWorkflowPanel={showWorkflowPanel}
            setShowWorkflowPanel={setShowWorkflowPanel}
            isMaximized={isMaximized}
            setIsMaximized={setIsMaximized}
            onNavigateBack={navigateToLibrary}
          />

          <div className="flex-1 min-h-0 flex">
            {/* Workflow Panel - Far Left */}
            {showWorkflowPanel && (
              <div className="w-[28rem] border-r bg-card/30 backdrop-blur-sm flex flex-col">
                <ScrollArea className="flex-1 h-full">
                  <div className="p-4">
                    <WorkflowPanel
                      report={report}
                      toast={toast}
                      updateWorkflowMutation={updateWorkflowMutation}
                      onClosePanel={() => setShowWorkflowPanel(false)}
                    />
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
              <Card className="h-full">
                <CardContent className="p-0 h-full">
                  <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col" data-testid="tabs-main-content">
                    <div className="px-6 pt-4 pb-3 space-y-4">
                      {/* Breadcrumb Navigation */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={navigateToLibrary}
                          className="gap-2 hover-elevate px-2 py-1 h-auto"
                          data-testid="breadcrumb-home"
                        >
                          <ArrowLeft className="h-3 w-3" />
                          All Requests
                        </Button>
                        <span className="text-muted-foreground/60">→</span>
                        <span className="font-medium text-foreground">Request #{id?.slice(-6)}</span>
                        <span className="text-muted-foreground/60">→</span>
                        <span className="font-medium text-primary">
                          Demand Analysis
                        </span>
                      </div>

                      {/* Tab Navigation - Innovative & Colorful */}
                      <div className="flex items-center justify-between px-2">
                        <TabsList className="grid w-full max-w-6xl grid-cols-5 h-auto gap-3 bg-transparent p-0" data-testid="tabslist-main">
                          <MaximizedTabTriggers access={{ canAccessBusinessCase, canAccessRequirements, canAccessEnterpriseArchitecture, canAccessStrategicFit }} />
                        </TabsList>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0">
                      <TabsContent
                        value="demand-information"
                        className="h-full m-0 p-6"
                        data-testid="tabcontent-demand-information"
                      >
                        <ScrollArea className="h-full">
                          <DemandInfoContent
                            report={report}
                            workflowActioned={!!workflowActioned}
                            id={id!}
                            updateWorkflowMutation={updateWorkflowMutation}
                            onShowSmartPanel={() => setShowSmartPanel(true)}
                            brainDecisionId={brainDecisionId}
                            brainStatus={brainStatus}
                            classification={classification}
                            classificationConfidence={classificationConfidence}
                            decisionSource={decisionSource}
                            coreviaPreApproved={coreviaPreApproved}
                            policyApprovalPending={policyApprovalPending}
                            approvalReasons={approvalReasons}
                            approvalRoutedToPmoDirector={approvalRoutedToPmoDirector}
                            onShowGovernance={() => setShowBrainGovernance(true)}
                          />
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent
                        value="business-case"
                        className="h-full m-0 p-6"
                        data-testid="tabcontent-business-case"
                      >
                        <ScrollArea className="h-full">
                          <ErrorBoundary fallback={<BusinessCaseSectionFallback onOpenDemandInfo={() => setActiveTab('demand-information')} />}>
                            <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
                              {canAccessBusinessCase ? (
                                <BusinessCaseTab
                                  reportId={id || ''}
                                  externalShowMeetingDialog={showScheduleMeetingDialog}
                                  onMeetingDialogChange={setShowScheduleMeetingDialog}
                                />
                              ) : <LockedWorkflowGate title="Business Case" message={lockedGateMessage} />}
                            </Suspense>
                          </ErrorBoundary>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent
                        value="detailed-requirements"
                        className="h-full m-0 overflow-hidden"
                        data-testid="tabcontent-detailed-requirements"
                      >
                        <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
                          {canAccessRequirements ? (
                            <DetailedRequirementsTab reportId={id!} highlightSection={highlightSection} />
                          ) : <LockedWorkflowGate title="Requirements" message={lockedGateMessage} />}
                        </Suspense>
                      </TabsContent>

                      <TabsContent
                        value="enterprise-architecture"
                        className="h-full m-0"
                        data-testid="tabcontent-enterprise-architecture"
                      >
                        <ScrollArea className="h-full">
                          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
                            {canAccessEnterpriseArchitecture ? (
                              <EnterpriseArchitectureTab
                                reportId={id || ""}
                                canAccess={canAccessEnterpriseArchitecture}
                                businessCaseApproved={businessCaseApproved}
                                requirementsApproved={requirementsApproved}
                              />
                            ) : <LockedWorkflowGate title="Enterprise Architecture" message={lockedGateMessage} />}
                          </Suspense>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent
                        value="strategic-fit"
                        className="h-full m-0"
                        data-testid="tabcontent-strategic-fit"
                      >
                        <ScrollArea className="h-full">
                          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
                            {canAccessStrategicFit ? (
                              <StrategicFitTab
                                reportId={id || ''}
                                canAccess={canAccessStrategicFit}
                                businessCaseApproved={businessCaseApproved}
                                requirementsApproved={requirementsApproved}
                                enterpriseArchitectureApproved={enterpriseArchitectureApproved}
                                enableIntelligenceRail={false}
                              />
                            ) : <LockedWorkflowGate title="Strategic Fit" message={lockedGateMessage} />}
                          </Suspense>
                        </ScrollArea>
                      </TabsContent>

                    </div>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Smart Resource Panel */}
        <SmartResourcePanel
          report={report}
          showSmartPanel={showSmartPanel}
          setShowSmartPanel={setShowSmartPanel}
          updateWorkflowMutation={updateWorkflowMutation}
          id={id!}
          toast={toast}
        />
      </div>
    );
  }

  // Regular view
  return (
    <div className="min-h-[100dvh] bg-background constellation-grid relative overflow-hidden flex flex-col">
      <div className="flex-shrink-0">
        <VersionManagementHeader
          report={report}
          workflowStatus={displayWorkflowStatus}
          workflowExpanded={workflowExpanded}
          setWorkflowExpanded={setWorkflowExpanded}
          showWorkflowPanel={showWorkflowPanel}
          setShowWorkflowPanel={setShowWorkflowPanel}
          isMaximized={isMaximized}
          setIsMaximized={setIsMaximized}
          onNavigateBack={navigateToLibrary}
        />
      </div>

      <div className="flex-1 min-h-0 flex gap-4 px-4 py-4 overflow-hidden">
        {/* Workflow Panel - Far Left */}
        {showWorkflowPanel && (
          <div className="w-[28rem] border-r bg-card/30 backdrop-blur-sm flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="p-4">
                <WorkflowPanel
                  report={report}
                  toast={toast}
                  updateWorkflowMutation={updateWorkflowMutation}
                  onClosePanel={() => setShowWorkflowPanel(false)}
                />
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <Card className="h-full flex flex-col overflow-hidden">
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
              <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col overflow-hidden" data-testid="tabs-main-content">
                <div className="px-6 pt-4 pb-4 flex-shrink-0 border-b border-border/50">
                  <div className="flex items-center justify-between gap-4">
                    <TabsList className="grid w-full max-w-6xl grid-cols-5 h-auto gap-2 bg-transparent p-0" data-testid="tabslist-main">
                      <CompactTabTriggers access={{ canAccessBusinessCase, canAccessRequirements, canAccessEnterpriseArchitecture, canAccessStrategicFit }} />
                    </TabsList>
                    {/* Maximize Button */}
                    {MAXIMIZABLE_TABS.has(activeTab) && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setMaximizedTab(activeTab as 'business-case' | 'detailed-requirements' | 'enterprise-architecture' | 'strategic-fit')}
                        className="flex-shrink-0"
                        data-testid="button-maximize-tab"
                      >
                        <Maximize className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    <TabsContent
                      value="demand-information"
                      className="h-full m-0 overflow-hidden"
                      data-testid="tabcontent-demand-information"
                    >
                      <ScrollArea className="h-full p-6">
                        <DemandInfoContent
                          report={report}
                          workflowActioned={!!workflowActioned}
                          id={id!}
                          updateWorkflowMutation={updateWorkflowMutation}
                          onShowSmartPanel={() => setShowSmartPanel(true)}
                          brainDecisionId={brainDecisionId}
                          brainStatus={brainStatus}
                          classification={classification}
                          classificationConfidence={classificationConfidence}
                          decisionSource={decisionSource}
                          coreviaPreApproved={coreviaPreApproved}
                          policyApprovalPending={policyApprovalPending}
                          approvalReasons={approvalReasons}
                          approvalRoutedToPmoDirector={approvalRoutedToPmoDirector}
                          onShowGovernance={() => setShowBrainGovernance(true)}
                        />
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent
                      value="business-case"
                      className="h-full m-0 overflow-hidden"
                      data-testid="tabcontent-business-case"
                    >
                      <ErrorBoundary fallback={<BusinessCaseSectionFallback onOpenDemandInfo={() => setActiveTab('demand-information')} />}>
                        <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
                          {canAccessBusinessCase ? (
                            <BusinessCaseTab
                              reportId={id || ''}
                              externalShowMeetingDialog={showScheduleMeetingDialog}
                              onMeetingDialogChange={setShowScheduleMeetingDialog}
                            />
                          ) : <LockedWorkflowGate title="Business Case" message={lockedGateMessage} />}
                        </Suspense>
                      </ErrorBoundary>
                    </TabsContent>

                    <TabsContent
                      value="detailed-requirements"
                      className="h-full m-0 overflow-hidden"
                      data-testid="tabcontent-detailed-requirements"
                    >
                      <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
                        {canAccessRequirements ? (
                          <DetailedRequirementsTab reportId={id!} />
                        ) : <LockedWorkflowGate title="Requirements" message={lockedGateMessage} />}
                      </Suspense>
                    </TabsContent>

                    <TabsContent
                      value="enterprise-architecture"
                      className="h-full m-0 overflow-hidden"
                      data-testid="tabcontent-enterprise-architecture"
                    >
                      <ScrollArea className="h-full">
                        <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
                          {canAccessEnterpriseArchitecture ? (
                            <EnterpriseArchitectureTab
                              reportId={id || ""}
                              canAccess={canAccessEnterpriseArchitecture}
                              businessCaseApproved={businessCaseApproved}
                              requirementsApproved={requirementsApproved}
                            />
                          ) : <LockedWorkflowGate title="Enterprise Architecture" message={lockedGateMessage} />}
                        </Suspense>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent
                      value="strategic-fit"
                      className="h-full m-0 overflow-hidden"
                      data-testid="tabcontent-strategic-fit"
                    >
                      <ScrollArea className="h-full">
                        <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
                          {canAccessStrategicFit ? (
                            <StrategicFitTab
                              reportId={id || ''}
                              canAccess={canAccessStrategicFit}
                              businessCaseApproved={businessCaseApproved}
                              requirementsApproved={requirementsApproved}
                              enterpriseArchitectureApproved={enterpriseArchitectureApproved}
                              enableIntelligenceRail={false}
                            />
                          ) : <LockedWorkflowGate title="Strategic Fit" message={lockedGateMessage} />}
                        </Suspense>
                      </ScrollArea>
                    </TabsContent>

                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Smart Resource Panel */}
        <SmartResourcePanel
          report={report}
          showSmartPanel={showSmartPanel}
          setShowSmartPanel={setShowSmartPanel}
          updateWorkflowMutation={updateWorkflowMutation}
          id={id!}
          toast={toast}
        />

        {/* Brain Governance Drawer */}
        <Sheet open={showBrainGovernance} onOpenChange={setShowBrainGovernance}>
          <SheetContent side="right" className="w-[420px] sm:w-[520px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <HexagonLogoFrame px={20} />
                Corevia Brain Governance
              </SheetTitle>
              <SheetDescription>
                Decision spine governance for this demand analysis.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Decision Spine</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Decision ID</span>
                    <span className="font-mono">{brainDecisionId || "Not available"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pipeline Source</span>
                    <span>{decisionSource}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    {isPmoDirectorApproved ? (
                      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        PMO Director Approved
                      </Badge>
                    ) : !policyApprovalRequired ? (
                      <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        Policy Pre-approved
                      </Badge>
                    ) : (
                      <Badge className={brainStatus.badgeClass}>{brainStatus.label}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Data Handling</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Classification</span>
                    <span className="capitalize">{classification}</span>
                  </div>
                  {classificationConfidenceLabel && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Confidence</span>
                      <span>{classificationConfidenceLabel}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Redaction Gateway</span>
                    <Badge variant="outline" className="text-xs">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Next Gate</span>
                    <span>{brainNextGate}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Attestations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Run attestation</span>
                    <Badge variant="outline" className="text-xs">Recorded</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Redaction receipt</span>
                    <Badge variant="outline" className="text-xs">Recorded</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Attestations are stored in the Brain ledger for audit and compliance.
                  </p>
                </CardContent>
              </Card>
            </div>
          </SheetContent>
        </Sheet>

        {/* Governance Pending Dialog */}
        <Dialog open={showGovernancePendingDialog} onOpenChange={setShowGovernancePendingDialog}>
          <DialogContent className="max-w-xl">
            <DialogHeader className="space-y-3 pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Shield className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Pending Governance Approval</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {governancePendingInfo?.demandTitle || 'Request'} requires review
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Status Message */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  This workflow action is on hold pending governance committee review.
                </p>
              </div>

              {/* Review Details */}
              {governancePendingInfo?.pendingApprovals && governancePendingInfo.pendingApprovals.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Review Details</p>
                  {governancePendingInfo.pendingApprovals.map((approval) => (
                    <div key={approval.id || approval.requestNumber} className="rounded-lg border bg-muted/30 overflow-hidden">
                      <div className="flex items-center justify-between p-3 bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{approval.requestNumber}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {approval.status === 'pending_approval' ? 'Under Review' : 'Awaiting Response'}
                        </Badge>
                      </div>

                      {/* Review Criteria */}
                      {approval.blockReasons && approval.blockReasons.length > 0 && (
                        <div className="p-3 space-y-2">
                          <p className="text-xs text-muted-foreground">Review triggered by:</p>
                          <ul className="space-y-1.5">
                            {approval.blockReasons.map((reason) => (
                              <li key={reason} className="text-sm flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Communicate with Governance Team */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Communicate with Governance Team</span>
                </div>
                <div className="space-y-1">
                  <Textarea
                    placeholder="Provide additional context or request expedited review..."
                    value={governanceMessage}
                    onChange={(e) => setGovernanceMessage(e.target.value.slice(0, 1000))}
                    maxLength={1000}
                    className="min-h-[100px] resize-none border-muted"
                    data-testid="input-governance-message"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{governanceMessage.length < 10 && governanceMessage.length > 0 ? 'Message too short' : ''}</span>
                    <span>{governanceMessage.length}/1000</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="default"
                    disabled={!governanceMessage.trim() || governanceMessage.length < 10 || sendingGovernanceMessage || !governancePendingInfo?.pendingApprovals?.[0]?.id}
                    onClick={async () => {
                      if (!governancePendingInfo?.pendingApprovals?.[0]?.id) return;
                      setSendingGovernanceMessage(true);
                      try {
                        const requestId = governancePendingInfo.pendingApprovals[0].id;
                        const response = await fetch(`/api/decision-brain/send-requester-message/${requestId}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ message: governanceMessage }),
                          credentials: 'include',
                        });
                        if (response.ok) {
                          toast({
                            title: t('demand.messageSent'),
                            description: t('demand.messageDeliveredToGovernance'),
                          });
                          setGovernanceMessage("");
                        } else {
                          throw new Error("Failed to send message");
                        }
                      } catch (err) {
                        const errMessage = err instanceof Error ? err.message : t('demand.unableToSendMessage');
                        toast({
                          title: t('demand.deliveryFailed'),
                          description: errMessage,
                          variant: "destructive",
                        });
                      } finally {
                        setSendingGovernanceMessage(false);
                      }
                    }}
                    data-testid="button-send-governance-message"
                  >
                    {sendingGovernanceMessage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Status Notice */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  You will receive a notification when the governance review is complete.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setShowGovernancePendingDialog(false)}>
                Understood
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Fullscreen Tab Dialog */}
        <Dialog open={maximizedTab !== null} onOpenChange={(open) => !open && setMaximizedTab(null)}>
          <DialogContent className="max-w-[98vw] w-[98vw] max-h-[95vh] h-[95vh] p-0 overflow-y-auto" data-testid="dialog-fullscreen-tab">
            <div className="flex flex-col min-h-full">
              <DialogHeader className="flex-shrink-0 px-6 py-4 border-b flex flex-row items-center justify-between sticky top-0 z-50 bg-background">
                <DialogTitle className="flex items-center gap-3">
                  <FullscreenTabDialogTitle maximizedTab={maximizedTab} />
                </DialogTitle>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMaximizedTab(null)}
                  className="flex-shrink-0"
                  data-testid="button-minimize-tab"
                >
                  <Minimize className="h-4 w-4" />
                </Button>
              </DialogHeader>
              <div className="p-0">
                <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
                  {maximizedTab === 'business-case' && (
                    <ErrorBoundary fallback={<BusinessCaseSectionFallback onOpenDemandInfo={() => {
                      setMaximizedTab(null);
                      setActiveTab('demand-information');
                    }} />}>
                      {canAccessBusinessCase ? (
                        <BusinessCaseTab
                          reportId={id || ''}
                          externalShowMeetingDialog={showScheduleMeetingDialog}
                          onMeetingDialogChange={setShowScheduleMeetingDialog}
                          isFullscreen={true}
                        />
                      ) : <LockedWorkflowGate title="Business Case" message={lockedGateMessage} />}
                    </ErrorBoundary>
                  )}
                  {maximizedTab === 'detailed-requirements' && (
                    canAccessRequirements ? (
                      <DetailedRequirementsTab reportId={id!} highlightSection={highlightSection} isFullscreen={true} />
                    ) : <LockedWorkflowGate title="Requirements" message={lockedGateMessage} />
                  )}
                  {maximizedTab === 'enterprise-architecture' && (
                    canAccessEnterpriseArchitecture ? (
                      <EnterpriseArchitectureTab
                        reportId={id || ""}
                        canAccess={canAccessEnterpriseArchitecture}
                        businessCaseApproved={businessCaseApproved}
                        requirementsApproved={requirementsApproved}
                        isFullscreen={true}
                      />
                    ) : <LockedWorkflowGate title="Enterprise Architecture" message={lockedGateMessage} />
                  )}
                  {maximizedTab === 'strategic-fit' && (
                    canAccessStrategicFit ? (
                      <StrategicFitTab
                        reportId={id || ''}
                        canAccess={canAccessStrategicFit}
                        businessCaseApproved={businessCaseApproved}
                        requirementsApproved={requirementsApproved}
                        enterpriseArchitectureApproved={enterpriseArchitectureApproved}
                        isFullscreen={true}
                        enableIntelligenceRail={false}
                      />
                    ) : <LockedWorkflowGate title="Strategic Fit" message={lockedGateMessage} />
                  )}
                </Suspense>
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}
