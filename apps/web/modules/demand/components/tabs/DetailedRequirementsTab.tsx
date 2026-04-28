import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, isBlockedGenerationError } from "@/lib/queryClient";
import { openBlockedGenerationDialog } from "@/components/shared/BlockedGenerationDialog";
import { useToast } from "@/hooks/use-toast";
import { fetchDecision, runActions } from "@/api/brain";
import { summarizeBrainEngineUsage } from "./brainEngineSummary";
import { fetchOptionalDemandArtifact } from "./optionalDemandArtifact";
import type { DetailedRequirementsDecisionRibbonProps } from "./DetailedRequirementsTab.decision-ribbon";
import { DetailedRequirementsAiMetadata } from "./DetailedRequirementsTab.ai-metadata";
import { DetailedRequirementsBrainApprovalDrawer, DetailedRequirementsBrainGovernanceDrawer } from "./DetailedRequirementsTab.brain-drawers";
import { DetailedRequirementsDocumentChrome } from "./DetailedRequirementsTab.document-chrome";
import { DetailedRequirementsEmptyState } from "./DetailedRequirementsTab.empty-state";
import { DetailedRequirementsEmptyStateHeader } from "./DetailedRequirementsTab.empty-state-header";
import type { DetailedRequirementsGovernanceShellProps } from "./DetailedRequirementsTab.governance-shell";
import { DetailedRequirementsMarketResearchSheet } from "./DetailedRequirementsTab.market-research-sheet";
import { DataGovernanceIndicators, SectionProvenanceTags } from "./DetailedRequirementsTab.meta-badges";
import { getPriorityColor, PrioritySparkline } from "./DetailedRequirementsTab.priority";
import { DetailedRequirementsRequiredResources } from "./DetailedRequirementsTab.required-resources";
import { DetailedRequirementsRoles } from "./DetailedRequirementsTab.roles";
import { DetailedRequirementsStatusBanner } from "./DetailedRequirementsTab.status-banner";
import { DetailedRequirementsVersionSheet } from "./DetailedRequirementsTab.version-sheet";
import { Suspense, lazy, useState, useEffect, useCallback, useRef, useMemo, type Dispatch, type SetStateAction } from "react";
import { SectionAssignmentPopover, AssignmentStatusPanel } from "@/components/shared/collaboration";
import { REQUIREMENTS_SECTIONS } from "@shared/demandSections";
import type { SectionAssignment, Team, User, ReportVersion } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { Can } from "@/components/auth/Can";
import { useReportAccess } from "@/hooks/useReportAccess";
 
import type { LucideIcon } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  Sparkles,
  Loader2,

  CheckCircle2,
  ShieldCheck,
  Shield,

  Target,
  AlertCircle,


  BookOpen,

  Clock,





} from "lucide-react";

import type { MarketResearch } from "@/modules/demand/components/business-case";
import type { AIConfidence, AICitation } from "@shared/aiAdapters";

const VersionDetailView = lazy(() => import("@/components/shared/versioning/VersionDetailView"));
const VersionDiffViewer = lazy(() => import("@/components/shared/versioning/VersionDiffViewer"));
const VersionRestoreDialog = lazy(() => import("@/components/shared/versioning/VersionRestoreDialog"));
const DetailedRequirementsDialogs = lazy(async () => ({
  default: (await import("./DetailedRequirementsTab.dialogs")).DetailedRequirementsDialogs,
}));
const DetailedRequirementsIntelligenceRail = lazy(async () => ({
  default: (await import("./DetailedRequirementsTab.intelligence-rail")).DetailedRequirementsIntelligenceRail,
}));
const DetailedRequirementsCoreSections = lazy(async () => ({
  default: (await import("./DetailedRequirementsTab.core-sections")).DetailedRequirementsCoreSections,
}));
const DetailedRequirementsEnhancedSections = lazy(async () => ({
  default: (await import("./DetailedRequirementsTab.enhanced-sections")).DetailedRequirementsEnhancedSections,
}));
const BranchTreeView = lazy(async () => ({
  default: (await import("@/components/shared/branching/BranchTreeView")).BranchTreeView,
}));
const MergeDialog = lazy(async () => ({
  default: (await import("@/components/shared/branching/MergeDialog")).MergeDialog,
}));

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
type PriorityLevel = 'High' | 'Medium' | 'Low';
type RequirementsLayerKey = 'baseline' | 'delivery' | 'governance' | 'readiness';
type SectionAssignmentWithRelations = SectionAssignment & {
  team?: Team | null;
  user?: User | null;
  assignedByUser: User;
  statusUpdatedByUser?: User | null;
};

interface RequirementsAnalysis {
  capabilities: Array<{
    name: string;
    description: string;
    priority: PriorityLevel;
    reasoning: string;
  }>;
  capabilityGaps?: Array<{
    gap: string;
    currentState: string;
    targetState: string;
    recommendation: string;
  }>;
  functionalRequirements: Array<{
    id: string;
    requirement: string;
    description?: string;
    category: string;
    priority: PriorityLevel;
    acceptanceCriteria: string[];
    bestPractice: string;
    // Production-grade extensions
    subRequirements?: string[];       // testable breakdown
    testMethod?: string;              // e.g. 'Automated E2E', 'HIL simulation', 'Field pilot'
    moscow?: 'Must' | 'Should' | 'Could' | "Won't" | string;
    phase?: string;                   // MVP / Phase 1 / Phase 2
    linkedCapability?: string;
    businessOutcome?: string;
    owner?: string;
    risk?: string;
  }>;
  nonFunctionalRequirements: Array<{
    id: string;
    requirement: string;
    category: string;
    metric: string;
    priority: PriorityLevel;
    bestPractice: string;
    // Production-grade extensions
    scope?: string;                   // ingestion | end-to-end | dashboard display
    measurement?: string;             // how the metric is measured
    target?: string;
    threshold?: string;               // breach threshold / alerting
    rationale?: string;               // demand/forecast justification
    testMethod?: string;
    phase?: string;
    owner?: string;
  }>;
  securityRequirements: Array<{
    id: string;
    requirement: string;
    category: string;
    priority: PriorityLevel;
    compliance: string;
    implementation: string;
    // Control-level fields
    control?: string;                 // e.g. NIST AC-2, ISO 27001 A.9.2.3
    owner?: string;                   // accountable team / role
    logging?: string;                 // audit log scope
    monitoring?: string;              // SIEM / SOC integration
    keyRotation?: string;             // e.g. 'Every 90 days via HSM'
    incidentResponse?: string;        // runbook reference
    testingRequirement?: string;      // pentest / red team / SAST/DAST
    phase?: string;
    keyManagement?: string;
    auditRetention?: string;
    privilegedAccess?: string;
    secretsManagement?: string;
    modelSecurity?: string;
    dataMasking?: string;
    incidentSeverity?: string;
    failureImpact?: string;
    source?: string;
    priorityRationale?: string;
  }>;
  worldClassRecommendations?: {
    industryBestPractices: string[];
    technologyStack: string[];
    architecturePatterns: string[];
    securityFrameworks: string[];
    complianceStandards: string[];
  };
  requiredResources?: {
    teamSize: string;
    budgetEstimate: string;
    timelineEstimate: string;
    infrastructure: string[];
  };
  estimatedEffort?: {
    totalEffort: string;
    phases: Array<{
      phase: string;
      duration: string;
      effort: string;
      deliverables: string[];
    }>;
  };
  rolesAndResponsibilities?: Array<{
    role: string;
    count: string;
    responsibilities: string[];
    skills: string[];
  }>;
  requiredTechnology?: {
    frontend: string[];
    backend: string[];
    database: string[];
    infrastructure: string[];
    tools: string[];
  };
  // Fields from AI engine that hold project context
  outOfScope?: string[];
  assumptions?: string[];
  constraints?: string[];
  dependencies?: string[];
  traceability?: {
    linkedDemandId?: string;
    linkedBusinessCaseId?: string | null;
  };

  // Enterprise-grade extensions (production-ready requirements baseline)
  integrations?: Array<{
    id: string;
    name: string;
    type?: string;              // e.g. 'Dispatch', 'Payment', 'RTA API', 'OEM Platform', 'Maps', 'CRM', 'ERP', 'SOC'
    direction?: 'inbound' | 'outbound' | 'bi-directional' | string;
    protocol?: string;          // REST, gRPC, MQTT, Kafka, SFTP, etc.
    dataExchanged?: string;
    frequency?: string;         // real-time, batch, event-driven
    sla?: string;               // availability / latency commitment
    security?: string;          // mTLS, OAuth2, VPN, IP allow-list
    owner?: string;
    dependency?: string;        // external team or vendor
    phase?: string;             // MVP / Phase 1 / Phase 2
  }>;
  dataRequirements?: Array<{
    id: string;
    entity: string;             // e.g. 'Trip', 'Driver', 'Fare', 'Vehicle Telemetry'
    classification?: string;    // Public | Internal | Confidential | Restricted | PII
    residency?: string;         // e.g. 'UAE-only'
    source?: string;
    retention?: string;         // e.g. '7 years (NESA)'
    qualityRules?: string[];
    owner?: string;
    reportingUse?: string;      // linked dashboards / reports
    lineage?: string;
  }>;
  operationalRequirements?: Array<{
    id: string;
    workflow: string;           // e.g. 'Fleet Control Center dispatch override'
    trigger?: string;
    escalationPath?: string;
    failSafeMode?: string;      // e.g. 'Safe-stop, minimal risk condition'
    manualOverride?: string;    // governance / audit
    rto?: string;               // recovery time objective
    rpo?: string;               // recovery point objective
    owner?: string;
    safetyCritical?: boolean;
    phase?: string;
  }>;
  phasePlan?: Array<{
    phase: string;              // MVP / Phase 1 / Phase 2
    name?: string;
    timing?: string;
    objectives?: string[];
    mustHave?: string[];
    shouldHave?: string[];
    couldHave?: string[];
    wontHave?: string[];
    exitCriteria?: string[];
  }>;
  businessOutcomes?: Array<{
    id: string;
    outcome: string;            // e.g. 'Safety', 'Utilization', 'Revenue', 'CX', 'Compliance'
    driver?: string;
    metric?: string;
    baseline?: string;
    target?: string;
    linkedCapabilities?: string[];
    linkedRequirementIds?: string[];
  }>;
  traceabilityMatrix?: Array<{
    capability: string;
    requirementId: string;
    acceptanceCriteriaRef?: string;
    phase?: string;
    owner?: string;
    testMethod?: string;
    businessOutcome?: string;
  }>;
  procurement?: Array<{
    item: string;
    type?: string;              // Platform, Vehicle OEM, Telecom, Integrator, Services
    supplier?: string;
    readiness?: string;         // Market-ready / RFP / Pilot
    dependency?: string;
    notes?: string;
  }>;
  meta?: {
    engine?: string;
    confidence?: number;
    generatedAt?: string;
  };
  marketResearch?: MarketResearch | null;
  marketResearchGeneratedAt?: string | null;
}

interface DetailedRequirementsTabProps {
  reportId: string;
  highlightSection?: string;
  isFullscreen?: boolean;
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeDisplayClassification(value: unknown): string | undefined {
  const normalized = readString(value)?.toLowerCase();
  return normalized === 'public' || normalized === 'internal' || normalized === 'confidential' || normalized === 'sovereign'
    ? normalized
    : undefined;
}

function normalizePriority(value: unknown): PriorityLevel {
  const normalizedValue = typeof value === 'string' ? value.toLowerCase().trim() : '';
  if (normalizedValue === 'high' || normalizedValue.includes('must') || normalizedValue === 'critical' || normalizedValue === 'essential') return 'High';
  if (normalizedValue === 'medium' || normalizedValue.includes('should') || normalizedValue === 'important' || normalizedValue === 'moderate') return 'Medium';
  if (normalizedValue === 'low' || normalizedValue.includes('could') || normalizedValue.includes('nice') || normalizedValue === 'optional') return 'Low';
  return 'Medium';
}

function normalizeAcceptanceCriteria(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    return [value];
  }

  return [];
}

function normalizeFunctionalRequirements(requirements: RequirementsAnalysis['functionalRequirements']): RequirementsAnalysis['functionalRequirements'] {
  if (!Array.isArray(requirements)) {
    return [];
  }

  return requirements.map((requirement: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const rawAcceptanceCriteria = Array.isArray(requirement.acceptanceCriteria) && requirement.acceptanceCriteria.length > 0
      ? requirement.acceptanceCriteria
      : requirement.acceptance || requirement.criteria || [];

    return {
      ...requirement,
      requirement: requirement.requirement || requirement.title || requirement.name || requirement.description || '',
      category: requirement.category || '',
      priority: normalizePriority(requirement.priority),
      acceptanceCriteria: normalizeAcceptanceCriteria(rawAcceptanceCriteria),
      bestPractice: requirement.bestPractice || requirement.best_practice || '',
    };
  });
}

function normalizeNonFunctionalRequirements(requirements: RequirementsAnalysis['nonFunctionalRequirements']): RequirementsAnalysis['nonFunctionalRequirements'] {
  if (!Array.isArray(requirements)) {
    return [];
  }

  return requirements.map((requirement: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    ...requirement,
    requirement: requirement.requirement || requirement.description || requirement.title || requirement.name || '',
    category: requirement.category || '',
    metric: requirement.metric || requirement.measure || requirement.target || '',
    priority: normalizePriority(requirement.priority || 'Medium'),
    bestPractice: requirement.bestPractice || requirement.best_practice || '',
  }));
}

function isSecurityRequirement(requirement: any): boolean { // eslint-disable-line @typescript-eslint/no-explicit-any
  const category = String(requirement.category || '').toLowerCase();
  const text = String(requirement.requirement || '').toLowerCase();
  return category.includes('security') || category.includes('compliance') || category.includes('privacy')
    || category.includes('safety') || category.includes('access') || category.includes('data protection')
    || text.includes('security') || text.includes('encrypt') || text.includes('auth')
    || text.includes('cyber') || text.includes('compliance') || text.includes('safety')
    || text.includes('access control') || text.includes('audit') || text.includes('gdpr')
    || text.includes('data protection') || text.includes('vulnerability') || text.includes('backup')
    || text.includes('disaster recovery') || text.includes('incident');
}

function mergeSecurityRequirements(
  securityRequirements: RequirementsAnalysis['securityRequirements'],
  nonFunctionalRequirements: RequirementsAnalysis['nonFunctionalRequirements'],
): RequirementsAnalysis['securityRequirements'] {
  const existingSecurityRequirements = Array.isArray(securityRequirements) ? securityRequirements : [];
  const existingIds = new Set(existingSecurityRequirements.map((requirement: any) => String(requirement.id || '').toLowerCase())); // eslint-disable-line @typescript-eslint/no-explicit-any
  const existingTexts = new Set(existingSecurityRequirements.map((requirement: any) => String(requirement.requirement || '').toLowerCase().trim())); // eslint-disable-line @typescript-eslint/no-explicit-any
  const derivedRequirements = nonFunctionalRequirements
    .filter((requirement: any) => isSecurityRequirement(requirement)) // eslint-disable-line @typescript-eslint/no-explicit-any
    .filter((requirement: any) => !existingIds.has(String(requirement.id || '').toLowerCase()) && !existingTexts.has(String(requirement.requirement || '').toLowerCase().trim())) // eslint-disable-line @typescript-eslint/no-explicit-any
    .map((requirement: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      id: requirement.id || '',
      requirement: requirement.requirement || '',
      category: requirement.category || 'Security',
      priority: normalizePriority(requirement.priority || 'High'),
      compliance: requirement.metric || requirement.compliance || '',
      implementation: requirement.bestPractice || requirement.implementation || '',
    }));

  return [...existingSecurityRequirements, ...derivedRequirements];
}

function deriveCapabilities(requirements: RequirementsAnalysis): RequirementsAnalysis['capabilities'] {
  if (Array.isArray(requirements.capabilities) && requirements.capabilities.length > 0) {
    return requirements.capabilities;
  }

  if (requirements.functionalRequirements.length === 0) {
    return [];
  }

  const categories = new Map<string, any[]>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const requirement of requirements.functionalRequirements) {
    const category = requirement.category || 'Core Capability';
    const categoryItems = categories.get(category);
    if (categoryItems) {
      categoryItems.push(requirement);
    } else {
      categories.set(category, [requirement]);
    }
  }

  if (categories.size > 1) {
    return Array.from(categories.entries()).map(([category, categoryItems]) => ({
      name: category,
      description: categoryItems.map((item: any) => item.requirement).filter(Boolean).join('; '), // eslint-disable-line @typescript-eslint/no-explicit-any
      priority: normalizePriority(categoryItems[0]?.priority),
      reasoning: `Derived from ${categoryItems.length} functional requirement(s)`,
    }));
  }

  return requirements.functionalRequirements.map((requirement: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    name: requirement.requirement || 'Capability',
    description: requirement.description || requirement.requirement || '',
    priority: normalizePriority(requirement.priority),
    reasoning: requirement.bestPractice || requirement.acceptance || '',
  }));
}

function normalizeRolesAndResponsibilities(
  rolesAndResponsibilities: RequirementsAnalysis['rolesAndResponsibilities'],
): RequirementsAnalysis['rolesAndResponsibilities'] {
  if (!rolesAndResponsibilities) {
    return rolesAndResponsibilities;
  }

  return Array.isArray(rolesAndResponsibilities)
    ? rolesAndResponsibilities.map((role: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        ...role,
        responsibilities: Array.isArray(role.responsibilities) ? role.responsibilities : [],
        skills: Array.isArray(role.skills) ? role.skills : [],
      }))
    : [];
}

function normalizeRequiredTechnology(
  requiredTechnology: RequirementsAnalysis['requiredTechnology'],
): RequirementsAnalysis['requiredTechnology'] {
  if (!requiredTechnology) {
    return requiredTechnology;
  }

  return {
    frontend: Array.isArray(requiredTechnology.frontend) ? requiredTechnology.frontend : [],
    backend: Array.isArray(requiredTechnology.backend) ? requiredTechnology.backend : [],
    database: Array.isArray(requiredTechnology.database) ? requiredTechnology.database : [],
    infrastructure: Array.isArray(requiredTechnology.infrastructure) ? requiredTechnology.infrastructure : [],
    tools: Array.isArray(requiredTechnology.tools) ? requiredTechnology.tools : [],
  };
}

function normalizeRequiredResources(
  requiredResources: RequirementsAnalysis['requiredResources'],
): RequirementsAnalysis['requiredResources'] {
  if (!requiredResources) {
    return requiredResources;
  }

  return {
    ...requiredResources,
    infrastructure: Array.isArray(requiredResources.infrastructure) ? requiredResources.infrastructure : [],
  };
}

function normalizeWorldClassRecommendations(
  recommendations: RequirementsAnalysis['worldClassRecommendations'],
): RequirementsAnalysis['worldClassRecommendations'] {
  if (!recommendations) {
    return recommendations;
  }

  return {
    industryBestPractices: Array.isArray(recommendations.industryBestPractices) ? recommendations.industryBestPractices : [],
    technologyStack: Array.isArray(recommendations.technologyStack) ? recommendations.technologyStack : [],
    architecturePatterns: Array.isArray(recommendations.architecturePatterns) ? recommendations.architecturePatterns : [],
    securityFrameworks: Array.isArray(recommendations.securityFrameworks) ? recommendations.securityFrameworks : [],
    complianceStandards: Array.isArray(recommendations.complianceStandards) ? recommendations.complianceStandards : [],
  };
}

function normalizeEstimatedEffort(
  estimatedEffort: RequirementsAnalysis['estimatedEffort'],
): RequirementsAnalysis['estimatedEffort'] {
  if (!estimatedEffort?.phases || Array.isArray(estimatedEffort.phases)) {
    return estimatedEffort;
  }

  return { ...estimatedEffort, phases: [] };
}

function normalizeRequirementsAnalysis(rawRequirements: RequirementsAnalysis): RequirementsAnalysis {
  const normalizedRequirements: RequirementsAnalysis = { ...rawRequirements };
  normalizedRequirements.functionalRequirements = normalizeFunctionalRequirements(normalizedRequirements.functionalRequirements);
  normalizedRequirements.nonFunctionalRequirements = normalizeNonFunctionalRequirements(normalizedRequirements.nonFunctionalRequirements);
  normalizedRequirements.securityRequirements = mergeSecurityRequirements(
    normalizedRequirements.securityRequirements,
    normalizedRequirements.nonFunctionalRequirements,
  );
  normalizedRequirements.capabilities = deriveCapabilities(normalizedRequirements);

  if (normalizedRequirements.capabilityGaps && !Array.isArray(normalizedRequirements.capabilityGaps)) {
    normalizedRequirements.capabilityGaps = [];
  }
  normalizedRequirements.rolesAndResponsibilities = normalizeRolesAndResponsibilities(normalizedRequirements.rolesAndResponsibilities);
  normalizedRequirements.requiredTechnology = normalizeRequiredTechnology(normalizedRequirements.requiredTechnology);
  normalizedRequirements.requiredResources = normalizeRequiredResources(normalizedRequirements.requiredResources);
  normalizedRequirements.worldClassRecommendations = normalizeWorldClassRecommendations(normalizedRequirements.worldClassRecommendations);
  normalizedRequirements.estimatedEffort = normalizeEstimatedEffort(normalizedRequirements.estimatedEffort);

  return normalizedRequirements;
}

function scrollToHighlightedRequirementsSection(
  highlightSection: string,
  scheduleHighlightClear: () => void,
): void {
  const scrollToSection = (): boolean => {
    const element = document.getElementById(`section-${highlightSection}`);
    console.log('🔍 Looking for element:', `section-${highlightSection}`, element);

    if (!element) {
      return false;
    }

    console.log('✅ Element found, scrolling...');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    scheduleHighlightClear();
    return true;
  };

  console.log('🎯 Highlighting section:', highlightSection);
  globalThis.setTimeout(() => {
    if (scrollToSection()) {
      return;
    }

    console.warn('❌ Element not found:', `section-${highlightSection}`);
    globalThis.setTimeout(() => {
      if (!scrollToSection()) {
        console.error('❌ Element still not found after retry');
      }
    }, 1000);
  }, 1000);
}

function getRequirementsBrainStatus(
  workflowStatus: string | undefined,
  t: (key: string) => string,
): { label: string; badgeClass: string; nextGate: string } {
  if (workflowStatus === "rejected") {
    return {
      label: t('demand.tabs.requirements.brain.blocked'),
      badgeClass: "bg-red-500/10 text-red-600 border-red-500/20",
      nextGate: t('demand.tabs.requirements.brain.revisionOrWithdrawal')
    };
  }

  if (workflowStatus === "requires_more_info" || workflowStatus === "deferred") {
    return {
      label: t('demand.tabs.requirements.brain.needsInfo'),
      badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      nextGate: t('demand.tabs.requirements.brain.clarification')
    };
  }

  if (workflowStatus === "manager_approved" || workflowStatus === "pending_conversion" || workflowStatus === "converted") {
    return {
      label: t('demand.tabs.requirements.brain.approved'),
      badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      nextGate: t('demand.tabs.requirements.brain.execution')
    };
  }

  if (workflowStatus === "manager_approval") {
    return {
      label: t('demand.tabs.requirements.brain.finalApproval'),
      badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      nextGate: t('demand.tabs.requirements.brain.directorSignoff')
    };
  }

  if (workflowStatus === "initially_approved") {
    return {
      label: t('demand.tabs.requirements.brain.preApproved'),
      badgeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
      nextGate: t('demand.tabs.requirements.brain.directorReview')
    };
  }

  if (workflowStatus === "meeting_scheduled") {
    return {
      label: t('demand.tabs.requirements.brain.reviewScheduled'),
      badgeClass: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      nextGate: t('demand.tabs.requirements.brain.panelReview')
    };
  }

  if (workflowStatus === "under_review" || workflowStatus === "acknowledged") {
    return {
      label: t('demand.tabs.requirements.brain.inReview'),
      badgeClass: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
      nextGate: t('demand.tabs.requirements.brain.validation')
    };
  }

  return {
    label: t('demand.tabs.requirements.brain.generated'),
    badgeClass: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    nextGate: t('demand.tabs.requirements.brain.review')
  };
}

function getRequirementsStatusBadge(status: string, t: (key: string) => string) {
  const statusConfig: Record<string, { variant: BadgeVariant; label: string }> = {
    draft: { variant: "secondary", label: t('demand.tabs.requirements.status.draft') },
    under_review: { variant: "outline", label: t('demand.tabs.requirements.status.underReview') },
    approved: { variant: "default", label: t('demand.tabs.requirements.status.approved') },
    manager_approval: { variant: "default", label: t('demand.tabs.requirements.status.finalApproval') },
    published: { variant: "default", label: t('demand.tabs.requirements.status.published') },
    archived: { variant: "secondary", label: t('demand.tabs.requirements.status.archived') },
    rejected: { variant: "destructive", label: t('demand.tabs.requirements.status.rejected') },
    superseded: { variant: "secondary", label: t('demand.tabs.requirements.status.superseded') }
  };
  const config = statusConfig[status] || { variant: "secondary", label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getSectionAssignmentForCurrentUser(
  sectionName: string,
  currentUser: { id: string } | null | undefined,
  assignments: SectionAssignmentWithRelations[],
  userAssignedSectionsWithStatus: Array<{ sectionName: string; status: string }>,
) {
  if (!currentUser) {
    return null;
  }

  const assignment = assignments.find((item) => item.sectionName === sectionName);
  if (!assignment) {
    return null;
  }

  if (assignment.assignedToUserId === currentUser.id) {
    return assignment;
  }

  if (assignment.assignedToTeamId && userAssignedSectionsWithStatus.some((section) => section.sectionName === sectionName)) {
    return assignment;
  }

  return null;
}

type ToastFn = ReturnType<typeof useToast>["toast"];
type TranslateFn = ReturnType<typeof useTranslation>["t"];
type RequirementsQueryData = { success: boolean; data: RequirementsAnalysis } | undefined;
type BlockingGateState = null | { layer: number; status: string; message: string };
type GenerationProgressState = {
  message: string;
  percentage: number;
  step: number;
  elapsedSeconds: number;
  startTime: number;
} | null;
type AiFallbackDialogState = {
  kind: 'policy_blocked' | 'classification_blocked' | 'provider_unavailable' | 'pipeline_error';
  reason: string;
} | null;

function useRequirementsGeneration(params: {
  reportId: string;
  queryClient: ReturnType<typeof useQueryClient>;
  requirements: RequirementsAnalysis | null;
  requirementsData: RequirementsQueryData;
  isLoading: boolean;
  isVersionLocked: boolean;
  t: TranslateFn;
  toast: ToastFn;
  setEditedRequirements: Dispatch<SetStateAction<RequirementsAnalysis | null>>;
  setBlockingGate: Dispatch<SetStateAction<BlockingGateState>>;
}) {
  const [, requirementsLocationSetter] = useLocation();
  const [generationProgress, setGenerationProgress] = useState<GenerationProgressState>(null);
  const [showAiFallbackChoiceDialog, setShowAiFallbackChoiceDialog] = useState(false);
  const [aiFallbackSections, setAiFallbackSections] = useState<string[]>([]);
  const [aiFallbackState, setAiFallbackState] = useState<AiFallbackDialogState>(null);
  const [generatedCitations, setGeneratedCitations] = useState<AICitation[] | null>(null);
  const [generatedConfidence, setGeneratedConfidence] = useState<AIConfidence | null>(null);
  const [marketResearch, setMarketResearch] = useState<MarketResearch | null>(null);
  const [isGeneratingResearch, setIsGeneratingResearch] = useState(false);
  const [showMarketResearchPanel, setShowMarketResearchPanel] = useState(false);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastProgressRef = useRef(0);
  const autoGenAttemptedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  const handleGenerateMarketResearch = useCallback(async () => {
    setIsGeneratingResearch(true);
    try {
      const response = await apiRequest("POST", `/api/demand-reports/${params.reportId}/requirements/market-research`, {});
      const data = await response.json();

      if (!data?.success) {
        throw new Error(data?.error || "Failed to generate requirements market research");
      }

      setMarketResearch(data.data);
      setShowMarketResearchPanel(true);
      params.setEditedRequirements((current) => current ? { ...current, marketResearch: data.data } : current);

      await Promise.all([
        params.queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', params.reportId, 'requirements'] }),
        params.queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', params.reportId] }),
      ]);

      params.toast({
        title: 'Requirements market research ready',
        description: 'The latest requirements-focused market analysis is available in the intelligence panel.',
      });
    } catch (error) {
      params.toast({
        title: 'Requirements market research failed',
        description: error instanceof Error ? error.message : 'Unable to generate requirements market research.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingResearch(false);
    }
  }, [params]);

  const generateMutation = useMutation({
    mutationFn: async (options?: { generationMode?: 'prompt_on_fallback' | 'allow_fallback_template' | 'ai_only'; skipPrompt?: boolean; acceptFallback?: boolean }) => {
      lastProgressRef.current = 0;

      const startTime = Date.now();
      const progressSteps = [
        { step: 1, message: params.t('demand.tabs.requirements.progressStep1'), startPct: 5, endPct: 20 },
        { step: 2, message: params.t('demand.tabs.requirements.progressStep2'), startPct: 20, endPct: 40 },
        { step: 3, message: params.t('demand.tabs.requirements.progressStep3'), startPct: 40, endPct: 60 },
        { step: 4, message: params.t('demand.tabs.requirements.progressStep4'), startPct: 60, endPct: 80 },
        { step: 5, message: params.t('demand.tabs.requirements.progressStep5'), startPct: 80, endPct: 95 },
      ];

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      progressIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const totalDuration = 50;
        const linearProgress = Math.min((elapsed / totalDuration) * 95, 95);

        let currentStepIndex = 0;
        for (let index = 0; index < progressSteps.length; index += 1) {
          const progressStep = progressSteps[index];
          if (progressStep && linearProgress >= progressStep.startPct) {
            currentStepIndex = index;
          }
        }

        const step = progressSteps[currentStepIndex] ?? progressSteps[0] ?? { step: 1, message: '', startPct: 0, endPct: 0 };
        const newProgress = Math.max(lastProgressRef.current, Math.round(linearProgress));
        lastProgressRef.current = newProgress;

        setGenerationProgress({
          message: step.message,
          percentage: newProgress,
          step: step.step,
          startTime,
          elapsedSeconds: Math.floor(elapsed),
        });
      }, 500);

      try {
        params.setBlockingGate(null);
        const generateUrl = options?.acceptFallback
          ? `/api/demand-reports/${params.reportId}/generate-requirements?acceptFallback=true`
          : `/api/demand-reports/${params.reportId}/generate-requirements`;
        const response = await apiRequest("POST", generateUrl, {
          generationMode: options?.generationMode || 'prompt_on_fallback',
        });

        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }

        setGenerationProgress({
          message: params.t('demand.tabs.requirements.analysisComplete'),
          percentage: 100,
          step: 5,
          startTime,
          elapsedSeconds: Math.floor((Date.now() - startTime) / 1000),
        });

        globalThis.setTimeout(() => {
          setGenerationProgress(null);
          lastProgressRef.current = 0;
        }, 1500);

        return response.json();
      } catch (error) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setGenerationProgress(null);
        lastProgressRef.current = 0;
        throw error;
      }
    },
    onSuccess: (data) => {
      params.setBlockingGate(null);
      setGeneratedCitations(data.citations || null);
      setGeneratedConfidence(data.confidence || null);

      params.queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', params.reportId, 'requirements'] });
      params.toast({
        title: params.t('demand.tabs.requirements.requirementsGenerated'),
        description: data?.generationMeta?.templateUsed
          ? params.t('demand.tabs.requirements.templateBasedGenerated')
          : params.t('demand.tabs.requirements.aiPoweredGenerated'),
      });
    },
    onError: (error: Error, variables) => {
      const errorMessage = error.message || "";

      if (isBlockedGenerationError(error)) {
        openBlockedGenerationDialog(error.payload, (actionId) => {
          if (actionId === "retry") {
            generateMutation.mutate({ generationMode: 'prompt_on_fallback' });
          } else if (actionId === "use_template") {
            generateMutation.mutate({ generationMode: 'allow_fallback_template', acceptFallback: true });
          } else if (actionId === "request_approval") {
            requirementsLocationSetter("/governance/approvals");
          }
        });
        return;
      }

      if (errorMessage.startsWith("409:")) {
        try {
          const parsed = JSON.parse(errorMessage.substring(4).trim());
          if (parsed?.requiresUserChoice && !variables?.skipPrompt) {
            setAiFallbackSections(Array.isArray(parsed?.fallbackSections) ? parsed.fallbackSections : []);
            setAiFallbackState({
              kind: parsed?.failureKind || 'provider_unavailable',
              reason: parsed?.fallbackReason || parsed?.message || 'AI generation could not complete',
            });
            setShowAiFallbackChoiceDialog(true);
            return;
          }
        } catch {
          // fall through to default handling
        }
      }

      if (errorMessage.startsWith("400:")) {
        try {
          const parsed = JSON.parse(errorMessage.substring(4).trim());
          if (parsed?.details?.currentLayer != null) {
            params.setBlockingGate({
              layer: Number(parsed.details.currentLayer),
              status: String(parsed.details.status || "pending"),
              message: String(parsed.error || params.t('demand.tabs.requirements.generationBlockedByGate')),
            });
            return;
          }
        } catch {
          // fall through to toast
        }
      }

      params.toast({
        title: params.t('demand.tabs.requirements.generationFailed'),
        description: errorMessage || params.t('demand.tabs.requirements.failedToGenerate'),
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const needsGeneration = !params.requirements;
    const notGenerating = !generateMutation.isPending;
    const notLocked = !params.isVersionLocked;
    const notFailed = !generateMutation.isError;
    const notAttempted = !autoGenAttemptedRef.current;

    if (needsGeneration && notGenerating && !params.isLoading && notLocked && notFailed && notAttempted) {
      const timer = globalThis.setTimeout(() => {
        if (!autoGenAttemptedRef.current) {
          autoGenAttemptedRef.current = true;
          generateMutation.mutate({ generationMode: 'prompt_on_fallback' });
        }
      }, 1500);
      return () => globalThis.clearTimeout(timer);
    }

    return undefined;
  }, [generateMutation, params.isLoading, params.isVersionLocked, params.requirements, params.requirementsData]);

  return {
    aiFallbackSections,
    aiFallbackState,
    generateMutation,
    generatedCitations,
    generatedConfidence,
    generationProgress,
    handleGenerateMarketResearch,
    isGeneratingResearch,
    marketResearch,
    setShowAiFallbackChoiceDialog,
    setShowMarketResearchPanel,
    showAiFallbackChoiceDialog,
    showMarketResearchPanel,
  };
}

function useRequirementsVersionActions(params: {
  reportId: string;
  latestVersion: ReportVersion | null;
  currentUser: { id: string; displayName: string; role: string } | null | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
  refetchVersions: () => Promise<unknown>;
  toast: ToastFn;
  t: TranslateFn;
  approvalComments: string;
  finalApprovalComments: string;
  managerEmail: string;
  managerMessage: string;
  versionsData: { data?: ReportVersion[] } | undefined;
  latestRenderableVersion: ReportVersion | null;
  isEditMode: boolean;
  setShowApproveDialog: Dispatch<SetStateAction<boolean>>;
  setShowSendToDirectorDialog: Dispatch<SetStateAction<boolean>>;
  setShowFinalApproveDialog: Dispatch<SetStateAction<boolean>>;
  setApprovalComments: Dispatch<SetStateAction<string>>;
  setFinalApprovalComments: Dispatch<SetStateAction<string>>;
  setManagerEmail: Dispatch<SetStateAction<string>>;
  setManagerMessage: Dispatch<SetStateAction<string>>;
  setSelectedVersionForRestore: Dispatch<SetStateAction<ReportVersion | null>>;
  setConflictWarnings: Dispatch<SetStateAction<string[]>>;
  setIsVersionLockedForRestore: Dispatch<SetStateAction<boolean>>;
  setShowRestoreDialog: Dispatch<SetStateAction<boolean>>;
}) {
  const submitForReview = useMutation({
    mutationFn: async () => {
      if (!params.latestVersion) throw new Error("No version found");
      if (!params.currentUser) throw new Error("User not authenticated");
      return apiRequest("POST", `/api/versions/${params.latestVersion.id}/submit-review`, {
        submittedBy: params.currentUser.id,
        submittedByName: params.currentUser.displayName,
        submittedByRole: params.currentUser.role,
      });
    },
    onSuccess: async () => {
      await params.queryClient.invalidateQueries({
        queryKey: ['/api/demand-reports', params.reportId, 'versions'],
        exact: false,
      });
      await params.refetchVersions();
      params.toast({ title: params.t('demand.tabs.requirements.submittedForReview'), description: params.t('demand.tabs.requirements.submittedForReviewDesc') });
    },
  });

  const approveVersion = useMutation({
    mutationFn: async () => {
      if (!params.latestVersion) throw new Error("No version found");
      if (!params.currentUser) throw new Error("User not authenticated");

      return apiRequest("POST", `/api/demand-reports/${params.reportId}/versions/${params.latestVersion.id}/approve`, {
        approvedBy: params.currentUser.id,
        approvedByName: params.currentUser.displayName,
        approvedByRole: params.currentUser.role,
        approvalComments: params.approvalComments,
      });
    },
    onMutate: async () => {
      params.setShowApproveDialog(false);
      params.toast({
        title: params.t('demand.tabs.requirements.approvalSubmitted'),
        description: params.t('demand.tabs.requirements.updatingStatus'),
      });

      if (!params.latestVersion) {
        return {} as { previousVersions?: unknown[] };
      }

      await params.queryClient.cancelQueries({
        queryKey: ['/api/demand-reports', params.reportId, 'versions'],
        exact: false,
      });

      const previousVersions = params.queryClient.getQueriesData({
        queryKey: ['/api/demand-reports', params.reportId, 'versions'],
        exact: false,
      });

      params.queryClient.setQueriesData(
        { queryKey: ['/api/demand-reports', params.reportId, 'versions'], exact: false },
        (data: { data?: ReportVersion[] } | undefined) => {
          if (!data?.data || !Array.isArray(data.data)) return data;
          return {
            ...data,
            data: data.data.map((version: ReportVersion) =>
              version.id === params.latestVersion?.id
                ? { ...version, status: 'approved', approvedAt: new Date() }
                : version,
            ),
          };
        },
      );

      return { previousVersions };
    },
    onSuccess: async () => {
      try {
        await apiRequest('POST', '/api/intelligence/learning/feedback', {
          contentId: params.reportId,
          contentType: 'requirements',
          userId: params.currentUser?.id,
          feedbackType: 'accept',
          metadata: { versionId: params.latestVersion?.id, approvalType: 'initial', approvalComments: params.approvalComments },
        });
      } catch (feedbackError) {
        console.warn('[Learning] Failed to record requirements approval feedback:', feedbackError);
      }

      params.queryClient.invalidateQueries({
        queryKey: ['/api/demand-reports', params.reportId, 'versions'],
        exact: false,
      });
      await params.refetchVersions();
      params.queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', params.reportId] });
      params.toast({
        title: params.t('demand.tabs.requirements.initialApprovalComplete'),
        description: params.t('demand.tabs.requirements.versionApprovedEditable'),
      });
      params.setApprovalComments("");
      params.setManagerEmail("");
      params.setManagerMessage("");
    },
    onError: (_error, _variables, context) => {
      const previous = (context as { previousVersions?: Array<[readonly unknown[], unknown]> } | undefined)?.previousVersions;
      if (previous) {
        previous.forEach(([key, data]) => {
          params.queryClient.setQueryData(key, data);
        });
      }
      params.toast({
        title: params.t('demand.tabs.requirements.approvalFailed'),
        description: params.t('demand.tabs.requirements.couldNotUpdateApproval'),
        variant: 'destructive',
      });
    },
  });

  const sendToDirector = useMutation({
    mutationFn: async () => {
      if (!params.latestVersion) throw new Error("No version found");
      if (!params.currentUser) throw new Error("User not authenticated");
      if (!params.managerEmail.trim()) {
        throw new Error("Director email is required");
      }

      return apiRequest("POST", `/api/demand-reports/${params.reportId}/versions/${params.latestVersion.id}/send-to-manager`, {
        managerEmail: params.managerEmail.trim(),
        message: params.managerMessage || params.t('demand.tabs.requirements.readyForDirectorApproval'),
        sentBy: params.currentUser.id,
        sentByName: params.currentUser.displayName,
      });
    },
    onSuccess: async () => {
      params.queryClient.invalidateQueries({
        queryKey: ['/api/demand-reports', params.reportId, 'versions'],
        exact: false,
      });
      await params.refetchVersions();
      params.queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', params.reportId] });
      params.toast({
        title: params.t('demand.tabs.requirements.sentForDirectorApproval'),
        description: params.t('demand.tabs.requirements.versionSentToDirector', { email: params.managerEmail }),
      });
      params.setShowSendToDirectorDialog(false);
      params.setManagerEmail("");
      params.setManagerMessage("");
    },
    onError: (error: Error) => {
      params.toast({
        title: params.t('demand.tabs.requirements.errorSendingToDirector'),
        description: error.message || params.t('demand.tabs.requirements.failedToSendToDirector'),
        variant: 'destructive',
      });
    },
  });

  const finalApprove = useMutation({
    mutationFn: async () => {
      if (!params.latestVersion) throw new Error("No version found");
      if (!params.currentUser) throw new Error("User not authenticated");

      return apiRequest("POST", `/api/demand-reports/${params.reportId}/versions/${params.latestVersion.id}/approve`, {
        approvedBy: params.currentUser.id,
        approvedByName: params.currentUser.displayName,
        approvedByRole: params.currentUser.role,
        approvalComments: params.finalApprovalComments || `Final approval by ${params.currentUser.displayName}`,
      });
    },
    onSuccess: async () => {
      try {
        await apiRequest('POST', '/api/intelligence/learning/feedback', {
          contentId: params.reportId,
          contentType: 'requirements',
          userId: params.currentUser?.id,
          feedbackType: 'accept',
          metadata: { versionId: params.latestVersion?.id, approvalType: 'final', approvalComments: params.finalApprovalComments },
        });
      } catch (feedbackError) {
        console.warn('[Learning] Failed to record requirements final approval feedback:', feedbackError);
      }

      params.queryClient.invalidateQueries({
        queryKey: ['/api/demand-reports', params.reportId, 'versions'],
        exact: false,
      });
      await params.refetchVersions();
      params.queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', params.reportId] });
      params.toast({
        title: params.t('demand.tabs.requirements.finalApprovalComplete'),
        description: params.t('demand.tabs.requirements.versionPublishedLocked'),
      });
      params.setShowFinalApproveDialog(false);
      params.setFinalApprovalComments("");
    },
  });

  const confirmRestoreVersion = useMutation({
    mutationFn: async (versionId: string) => {
      const response = await apiRequest("POST", `/api/demand-reports/${params.reportId}/versions/${versionId}/restore`, {});
      return response.json();
    },
    onSuccess: (_result, versionId) => {
      const version = params.versionsData?.data?.find((item: ReportVersion) => item.id === versionId);
      params.queryClient.invalidateQueries({
        queryKey: ['/api/demand-reports', params.reportId, 'versions'],
        exact: false,
      });
      params.queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', params.reportId, 'requirements'] });

      params.toast({
        title: params.t('demand.tabs.requirements.versionRestored'),
        description: version
          ? params.t('demand.tabs.requirements.successfullyRestoredVersion', { version: version.versionNumber })
          : params.t('demand.tabs.requirements.versionRestoredSuccessfully'),
      });

      params.setShowRestoreDialog(false);
      params.setSelectedVersionForRestore(null);
      params.setConflictWarnings([]);
      params.setIsVersionLockedForRestore(false);
    },
    onError: (error: Error) => {
      params.toast({
        title: params.t('demand.tabs.requirements.restoreFailed'),
        description: error.message || params.t('demand.tabs.requirements.failedToRestore'),
        variant: 'destructive',
      });
    },
  });

  return {
    approveVersion,
    confirmRestoreVersion,
    finalApprove,
    sendToDirector,
    submitForReview,
  };
}

const DEFAULT_CAPABILITY = {
  name: '',
  description: '',
  priority: 'Medium' as const,
  reasoning: '',
};

const DEFAULT_NON_FUNCTIONAL_REQ = {
  id: '',
  requirement: '',
  category: '',
  metric: '',
  priority: 'Medium' as const,
  bestPractice: '',
};

const DEFAULT_SECURITY_REQ = {
  id: '',
  requirement: '',
  category: '',
  priority: 'High' as const,
  compliance: '',
  implementation: '',
};

const DEFAULT_CAPABILITY_GAP = {
  gap: '',
  currentState: '',
  targetState: '',
  recommendation: '',
};

const DEFAULT_ROLE = {
  role: '',
  count: '',
  responsibilities: [],
  skills: [],
};

function useRequirementsItemHandlers(
  editedRequirements: RequirementsAnalysis | null,
  setEditedRequirements: Dispatch<SetStateAction<RequirementsAnalysis | null>>,
) {
  const handleDeleteCapability = useCallback((index: number) => {
    if (!editedRequirements) return;
    const updated = editedRequirements.capabilities.filter((_, currentIndex) => currentIndex !== index);
    setEditedRequirements({ ...editedRequirements, capabilities: updated });
  }, [editedRequirements, setEditedRequirements]);

  const handleDeleteFunctionalRequirement = useCallback((index: number) => {
    if (!editedRequirements) return;
    const updated = editedRequirements.functionalRequirements.filter((_, currentIndex) => currentIndex !== index);
    setEditedRequirements({ ...editedRequirements, functionalRequirements: updated });
  }, [editedRequirements, setEditedRequirements]);

  const handleDeleteNonFunctionalRequirement = useCallback((index: number) => {
    if (!editedRequirements) return;
    const updated = editedRequirements.nonFunctionalRequirements.filter((_, currentIndex) => currentIndex !== index);
    setEditedRequirements({ ...editedRequirements, nonFunctionalRequirements: updated });
  }, [editedRequirements, setEditedRequirements]);

  const handleDeleteSecurityRequirement = useCallback((index: number) => {
    if (!editedRequirements) return;
    const updated = editedRequirements.securityRequirements.filter((_, currentIndex) => currentIndex !== index);
    setEditedRequirements({ ...editedRequirements, securityRequirements: updated });
  }, [editedRequirements, setEditedRequirements]);

  const handleDeleteCapabilityGap = useCallback((index: number) => {
    if (!editedRequirements?.capabilityGaps) return;
    const updated = editedRequirements.capabilityGaps.filter((_, currentIndex) => currentIndex !== index);
    setEditedRequirements({ ...editedRequirements, capabilityGaps: updated });
  }, [editedRequirements, setEditedRequirements]);

  const handleDeleteRole = useCallback((index: number) => {
    if (!editedRequirements?.rolesAndResponsibilities) return;
    const updated = editedRequirements.rolesAndResponsibilities.filter((_, currentIndex) => currentIndex !== index);
    setEditedRequirements({ ...editedRequirements, rolesAndResponsibilities: updated });
  }, [editedRequirements, setEditedRequirements]);

  const handleAddCapability = useCallback(() => {
    if (!editedRequirements) return;
    setEditedRequirements({
      ...editedRequirements,
      capabilities: [...editedRequirements.capabilities, DEFAULT_CAPABILITY],
    });
  }, [editedRequirements, setEditedRequirements]);

  const handleAddFunctionalRequirement = useCallback(() => {
    if (!editedRequirements) return;
    const newRequirement = { ...DEFAULT_NON_FUNCTIONAL_REQ, id: `FR-${Date.now()}`, acceptanceCriteria: [] };
    setEditedRequirements({
      ...editedRequirements,
      functionalRequirements: [...editedRequirements.functionalRequirements, newRequirement],
    });
  }, [editedRequirements, setEditedRequirements]);

  const handleAddNonFunctionalRequirement = useCallback(() => {
    if (!editedRequirements) return;
    const newRequirement = { ...DEFAULT_NON_FUNCTIONAL_REQ, id: `NFR-${Date.now()}` };
    setEditedRequirements({
      ...editedRequirements,
      nonFunctionalRequirements: [...editedRequirements.nonFunctionalRequirements, newRequirement],
    });
  }, [editedRequirements, setEditedRequirements]);

  const handleAddSecurityRequirement = useCallback(() => {
    if (!editedRequirements) return;
    const newRequirement = { ...DEFAULT_SECURITY_REQ, id: `SR-${Date.now()}` };
    setEditedRequirements({
      ...editedRequirements,
      securityRequirements: [...editedRequirements.securityRequirements, newRequirement],
    });
  }, [editedRequirements, setEditedRequirements]);

  const handleAddCapabilityGap = useCallback(() => {
    if (!editedRequirements) return;
    setEditedRequirements({
      ...editedRequirements,
      capabilityGaps: [...(editedRequirements.capabilityGaps || []), DEFAULT_CAPABILITY_GAP],
    });
  }, [editedRequirements, setEditedRequirements]);

  const handleAddRole = useCallback(() => {
    if (!editedRequirements) return;
    setEditedRequirements({
      ...editedRequirements,
      rolesAndResponsibilities: [...(editedRequirements.rolesAndResponsibilities || []), DEFAULT_ROLE],
    });
  }, [editedRequirements, setEditedRequirements]);

  return {
    handleAddCapability,
    handleAddCapabilityGap,
    handleAddFunctionalRequirement,
    handleAddNonFunctionalRequirement,
    handleAddRole,
    handleAddSecurityRequirement,
    handleDeleteCapability,
    handleDeleteCapabilityGap,
    handleDeleteFunctionalRequirement,
    handleDeleteNonFunctionalRequirement,
    handleDeleteRole,
    handleDeleteSecurityRequirement,
  };
}

function useRequirementsDraftEditing(params: {
  changedFields: Set<string>;
  currentUser: { id: string; displayName: string; role: string } | null | undefined;
  editedRequirements: RequirementsAnalysis | null;
  isVersionLocked: boolean;
  originalRequirements: RequirementsAnalysis | null;
  queryClient: ReturnType<typeof useQueryClient>;
  refetchVersions: () => Promise<unknown>;
  reportId: string;
  setChangedFields: Dispatch<SetStateAction<Set<string>>>;
  setEditedRequirements: Dispatch<SetStateAction<RequirementsAnalysis | null>>;
  setIsEditMode: Dispatch<SetStateAction<boolean>>;
  setOriginalRequirements: Dispatch<SetStateAction<RequirementsAnalysis | null>>;
  t: TranslateFn;
  toast: ToastFn;
  validationErrorsRef: React.MutableRefObject<Record<string, string>>;
}) {
  const detectChanges = useCallback(() => {
    if (!params.originalRequirements || !params.editedRequirements) return;

    const changes = new Set<string>();
    const hasContent = (value: unknown): boolean => {
      if (value === undefined || value === null) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') return Object.keys(value).length > 0;
      return true;
    };

    const detectSectionChange = (originalValue: unknown, editedValue: unknown, fieldName: string) => {
      const originalHasContent = hasContent(originalValue);
      const editedHasContent = hasContent(editedValue);

      if (!originalHasContent && editedHasContent) {
        changes.add(`${fieldName}:added`);
      } else if (originalHasContent && !editedHasContent) {
        changes.add(`${fieldName}:removed`);
      } else if (originalHasContent && editedHasContent) {
        if (JSON.stringify(originalValue) !== JSON.stringify(editedValue)) {
          changes.add(`${fieldName}:modified`);
        }
      }
    };

    if (JSON.stringify(params.editedRequirements.capabilities) !== JSON.stringify(params.originalRequirements.capabilities)) {
      changes.add('capabilities:modified');
    }
    if (JSON.stringify(params.editedRequirements.functionalRequirements) !== JSON.stringify(params.originalRequirements.functionalRequirements)) {
      changes.add('functionalRequirements:modified');
    }
    if (JSON.stringify(params.editedRequirements.nonFunctionalRequirements) !== JSON.stringify(params.originalRequirements.nonFunctionalRequirements)) {
      changes.add('nonFunctionalRequirements:modified');
    }
    if (JSON.stringify(params.editedRequirements.securityRequirements) !== JSON.stringify(params.originalRequirements.securityRequirements)) {
      changes.add('securityRequirements:modified');
    }

    detectSectionChange(params.originalRequirements.capabilityGaps, params.editedRequirements.capabilityGaps, 'capabilityGaps');
    detectSectionChange(params.originalRequirements.worldClassRecommendations, params.editedRequirements.worldClassRecommendations, 'worldClassRecommendations');
    detectSectionChange(params.originalRequirements.requiredResources, params.editedRequirements.requiredResources, 'requiredResources');
    detectSectionChange(params.originalRequirements.estimatedEffort, params.editedRequirements.estimatedEffort, 'estimatedEffort');
    detectSectionChange(params.originalRequirements.rolesAndResponsibilities, params.editedRequirements.rolesAndResponsibilities, 'rolesAndResponsibilities');
    detectSectionChange(params.originalRequirements.requiredTechnology, params.editedRequirements.requiredTechnology, 'requiredTechnology');

    params.setChangedFields(changes);
  }, [params]);

  useEffect(() => {
    detectChanges();
  }, [detectChanges]);

  const hasFieldChanged = useCallback((fieldName: string, changedFields: Set<string>): boolean => {
    return Array.from(changedFields).some((change) => change.startsWith(`${fieldName}:`));
  }, []);

  const getChangeType = useCallback((fieldName: string, changedFields: Set<string>): 'added' | 'removed' | 'modified' | null => {
    const change = Array.from(changedFields).find((value) => value.startsWith(`${fieldName}:`));
    if (!change) return null;
    const [, changeType] = change.split(':');
    return changeType as 'added' | 'removed' | 'modified';
  }, []);

  const getChangeBadgeText = useCallback((fieldName: string, changedFields: Set<string>): string => {
    const changeType = getChangeType(fieldName, changedFields);
    switch (changeType) {
      case 'added':
        return 'Added';
      case 'removed':
        return 'Removed';
      case 'modified':
        return 'Modified';
      default:
        return 'Modified';
    }
  }, [getChangeType]);

  const validateFields = useCallback((data: RequirementsAnalysis) => {
    const errors: Record<string, string> = {};
    if (data.capabilities && data.capabilities.length > 0) {
      data.capabilities.forEach((capability, index) => {
        if (!capability.name || capability.name.trim().length === 0) {
          errors[`capability_${index}_name`] = `Capability ${index + 1} name is required`;
        }
      });
    }
    return errors;
  }, []);

  const generateChangesSummary = useCallback((changedFields: Set<string>) => {
    if (changedFields.size === 0) {
      return 'Requirements draft updated';
    }

    const changedSections = Array.from(changedFields).map((change) => change.split(':')[0]).slice(0, 3);
    const remainingCount = changedFields.size - changedSections.length;
    if (remainingCount > 0) {
      return `Updated ${changedSections.join(', ')} and ${remainingCount} more section${remainingCount > 1 ? 's' : ''}`;
    }

    return `Updated ${changedSections.join(', ')}`;
  }, []);

  const handleCancel = useCallback(() => {
    params.validationErrorsRef.current = {};
    params.setChangedFields(new Set());
    params.setEditedRequirements(params.originalRequirements ? structuredClone(params.originalRequirements) : null);
    params.setIsEditMode(false);
  }, [params]);

  const handleSaveAndExit = useCallback(async (changedFields: Set<string>) => {
    if (params.isVersionLocked) {
      params.toast({
        title: params.t('demand.tabs.requirements.cannotSave'),
        description: params.t('demand.tabs.requirements.documentLockedDescription'),
        variant: 'destructive',
      });
      params.setIsEditMode(false);
      return;
    }

    if (!params.editedRequirements) {
      params.toast({
        title: params.t('demand.tabs.requirements.error'),
        description: params.t('demand.tabs.requirements.waitForData'),
        variant: 'destructive',
      });
      return;
    }

    if (!params.currentUser) {
      params.toast({
        title: params.t('demand.tabs.requirements.error'),
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }

    const errors = validateFields(params.editedRequirements);
    params.validationErrorsRef.current = errors;
    if (Object.keys(errors).length > 0) {
      params.toast({
        title: params.t('demand.tabs.requirements.validationError'),
        description: params.t('demand.tabs.requirements.fixErrorsFirst'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await apiRequest('POST', `/api/demand-reports/${params.reportId}/versions`, {
        versionType: 'patch',
        contentType: 'requirements',
        changesSummary: generateChangesSummary(changedFields),
        skipAiSummary: true,
        editReason: 'Requirements content update',
        createdBy: params.currentUser.id,
        createdByName: params.currentUser.displayName,
        createdByRole: params.currentUser.role,
        editedContent: params.editedRequirements,
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || data.details?.message || 'Failed to create version');
      }

      const savedRequirements = structuredClone(params.editedRequirements);
      params.setOriginalRequirements(savedRequirements);
      params.setEditedRequirements(savedRequirements);
      params.setChangedFields(new Set());
      params.setIsEditMode(false);

      await params.queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', params.reportId, 'requirements'] });
      await params.queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', params.reportId, 'versions'] });
      await params.refetchVersions();

      params.toast({
        title: params.t('demand.tabs.requirements.newDraftCreated'),
        description: 'Requirements draft version saved successfully.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create version';
      params.toast({
        title: params.t('demand.tabs.requirements.creationFailed'),
        description: message || params.t('demand.tabs.requirements.failedToCreateVersion'),
        variant: 'destructive',
      });
    }
  }, [generateChangesSummary, params, validateFields]);

  return {
    getChangeBadgeText: (fieldName: string) => getChangeBadgeText(fieldName, params.changedFields),
    handleCancel,
    handleSaveAndExit,
    hasFieldChanged: (fieldName: string) => hasFieldChanged(fieldName, params.changedFields),
  };
}

export default function DetailedRequirementsTab({ reportId, highlightSection, isFullscreen = false }: Readonly<DetailedRequirementsTabProps>) { // NOSONAR
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  // WebSocket integration for real-time collaboration
  const { send, subscribe, isConnected } = useWebSocket();

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedRequirements, setEditedRequirements] = useState<RequirementsAnalysis | null>(null);
  const [originalRequirements, setOriginalRequirements] = useState<RequirementsAnalysis | null>(null);
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const validationErrorsRef = useRef<Record<string, string>>({});
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showVersionSheet, setShowVersionSheet] = useState(false);

  // Section highlighting for notifications
  const [highlightedSection, setHighlightedSection] = useState<string | null>(highlightSection || null);
  const clearHighlightedSection = useCallback(() => {
    setHighlightedSection(null);
  }, []);
  const scheduleHighlightClear = useCallback(() => {
    globalThis.setTimeout(clearHighlightedSection, 5000);
  }, [clearHighlightedSection]);

  // Branch management state
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [showBranchTree, setShowBranchTree] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  // Version comparison state
  const [showVersionComparison, setShowVersionComparison] = useState(false);
  const [comparisonVersions, setComparisonVersions] = useState<{
    versionA: ReportVersion | null;
    versionB: ReportVersion | null;
  }>({ versionA: null, versionB: null });

  // Version detail/restore state
  const [showVersionDetail, setShowVersionDetail] = useState(false);
  const [selectedVersionForDetail, setSelectedVersionForDetail] = useState<ReportVersion | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedVersionForRestore, setSelectedVersionForRestore] = useState<ReportVersion | null>(null);
  const [conflictWarnings, setConflictWarnings] = useState<string[]>([]);
  const [isVersionLockedForRestore, setIsVersionLockedForRestore] = useState(false);

  // Conflict handling state
  const [editConflict, setEditConflict] = useState<{
    user: string;
    userId: string;
    versionId: string;
  } | null>(null);
  const [showEditConflictDialog, setShowEditConflictDialog] = useState(false);
  const currentVersionIdRef = useRef<string | null>(null);
  const currentActivityTypeRef = useRef<'viewing' | 'editing' | null>(null);

  // Scroll to highlighted section when component loads or highlightSection changes
  useEffect(() => {
    if (highlightSection) {
      setHighlightedSection(highlightSection);
      scrollToHighlightedRequirementsSection(highlightSection, scheduleHighlightClear);
    }
  }, [highlightSection, scheduleHighlightClear]);

  // Workflow action dialogs
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showSendToDirectorDialog, setShowSendToDirectorDialog] = useState(false);
  const [showFinalApproveDialog, setShowFinalApproveDialog] = useState(false);
  const [approvalComments, setApprovalComments] = useState("");
  const [finalApprovalComments, setFinalApprovalComments] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [showIntelligenceRail, setShowIntelligenceRail] = useState(false);
  const [requirementsLayer, setRequirementsLayer] = useState<RequirementsLayerKey>('baseline');
  const [managerMessage, setManagerMessage] = useState("");
  const [showBrainGovernance, setShowBrainGovernance] = useState(false);
  const [blockingGate, setBlockingGate] = useState<null | { layer: number; status: string; message: string }>(null);
  const [showBrainApproval, setShowBrainApproval] = useState(false);
  const [brainApprovalNotes, setBrainApprovalNotes] = useState("");
  const [brainApprovalAction, setBrainApprovalAction] = useState<"approve" | "revise" | "reject">("approve");
  const [selectedActionKeys, setSelectedActionKeys] = useState<string[]>([]);
  const [lastApprovalId, setLastApprovalId] = useState<string | null>(null);

  // Fetch demand report to get owner information for permission checks
  const { data: reportData } = useQuery({
    queryKey: ['/api/demand-reports', reportId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/demand-reports/${reportId}`);
      return response.json();
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Get permission access based on report ownership
  const reportAccess = useReportAccess({
    reportOwnerId: reportData?.data?.createdBy,
    workflowStatus: reportData?.data?.workflowStatus
  });

  const brainDecisionId = reportData?.data?.aiAnalysis?.decisionId;
  const useCaseType = "requirements_analysis";
  const brainStatus = getRequirementsBrainStatus(reportData?.data?.workflowStatus, t);
  const requestedClassification = reportData?.data?.dataClassification || reportData?.data?.aiAnalysis?.classificationLevel || "internal";
  const classificationConfidence = reportData?.data?.dataClassificationConfidence ?? reportData?.data?.aiAnalysis?.classificationConfidence;
  const decisionSource = reportData?.data?.aiAnalysis?.source || "COREVIA Brain";

  const { data: brainDecision } = useQuery({
    queryKey: ["decision", brainDecisionId, useCaseType],
    queryFn: () => fetchDecision(brainDecisionId, useCaseType),
    enabled: !!brainDecisionId,
    refetchOnWindowFocus: false,
  });

  const effectiveClassification = normalizeDisplayClassification(readRecord(readRecord(brainDecision).classification).level)
    || normalizeDisplayClassification(readRecord(readRecord(readRecord(brainDecision).spineOverview).spine).classification)
    || normalizeDisplayClassification(requestedClassification)
    || "internal";

  const actionItems = useMemo(() => {
    const advisory = (brainDecision as Record<string, unknown> | undefined)?.advisoryPackage || (brainDecision as Record<string, unknown> | undefined)?.advisory;
    const actions = ((advisory as Record<string, unknown> | undefined)?.actions || (advisory as Record<string, unknown> | undefined)?.plannedActions || []) as Array<Record<string, unknown>>;
    return actions.map((action: any, index: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const key = String(action?.id || action?.actionId || action?.key || `${index}`);
      const label = action?.title || action?.name || action?.actionType || action?.type || `Action ${index + 1}`;
      const description = action?.description || action?.summary || action?.details || "";
      return { key, label, description, raw: action };
    });
  }, [brainDecision]);

  useEffect(() => {
    if (actionItems.length > 0) {
      setSelectedActionKeys(actionItems.map((item) => item.key));
    }
  }, [actionItems]);

  useEffect(() => {
    const approvalId = (brainDecision as Record<string, unknown> | undefined)?.approval as Record<string, unknown> | undefined;
    if (approvalId?.approvalId) {
      setLastApprovalId(approvalId.approvalId as string);
    }
  }, [brainDecision]);

  const brainApprovalMutation = useMutation({
    mutationFn: async (payload: { action: "approve" | "revise" | "reject"; reason?: string }) => {
      if (!brainDecisionId) {
        throw new Error("No decision available for approval.");
      }

      const approvedActions = payload.action === "approve"
        ? actionItems.filter((item) => selectedActionKeys.includes(item.key)).map((item) => item.raw)
        : undefined;

      const response = await apiRequest("POST", `/api/corevia/decisions/${brainDecisionId}/approve`, {
        action: payload.action,
        reason: payload.reason?.trim() || undefined,
        approvedActions,
      });

      return response.json();
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["decision", brainDecisionId, useCaseType] });
      await queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId] });
      if (result?.approvalId) {
        setLastApprovalId(result.approvalId);
      }
      setShowBrainApproval(false);
      setBrainApprovalNotes("");
      toast({
        title: t('demand.tabs.requirements.governanceDecisionRecorded'),
        description: t('demand.tabs.requirements.brainApprovalGateUpdated'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('demand.tabs.requirements.approvalFailed'),
        description: error.message || t('demand.tabs.requirements.unableToUpdateBrain'),
        variant: "destructive",
      });
    }
  });

  const executeActionsMutation = useMutation({
    mutationFn: async () => {
      const approvalId = ((brainDecision as Record<string, unknown> | undefined)?.approval as Record<string, unknown> | undefined)?.approvalId as string | undefined || lastApprovalId;
      if (!brainDecisionId || !approvalId) {
        throw new Error("No approval available for execution.");
      }
      return runActions(brainDecisionId, approvalId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["decision", brainDecisionId, useCaseType] });
      await queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId] });
      toast({
        title: t('demand.tabs.requirements.actionsExecuted'),
        description: t('demand.tabs.requirements.approvedActionsExecuted'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('demand.tabs.requirements.executionFailed'),
        description: error.message || t('demand.tabs.requirements.unableToExecute'),
        variant: "destructive",
      });
    }
  });

  const { data: requirementsData, isLoading } = useQuery<{ success: boolean; data: RequirementsAnalysis }>({
    queryKey: ['/api/demand-reports', reportId, 'requirements'],
    queryFn: () => fetchOptionalDemandArtifact<{ success: boolean; data: RequirementsAnalysis }>(`/api/demand-reports/${reportId}/requirements`) as Promise<{ success: boolean; data: RequirementsAnalysis }>,
    retry: false,
  });

  const requirements = requirementsData?.success ? requirementsData.data : null;

  const requirementsArtifactMeta = (requirementsData as Record<string, unknown> | undefined)?.artifactMeta as Record<string, unknown> | undefined;
  const engineSummary = useMemo(
    () => summarizeBrainEngineUsage(brainDecision, requirementsArtifactMeta),
    [brainDecision, requirementsArtifactMeta]
  );

  // Fetch latest version for status display
  const { data: versionsData, refetch: refetchVersions } = useQuery({
    queryKey: ['/api/demand-reports', reportId, 'versions'],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/demand-reports/${reportId}/versions`);
      return response.json();
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    staleTime: 0,
  });

  const latestVersion = versionsData?.success && versionsData.data && versionsData.data.length > 0
    ? versionsData.data
        .filter((v: ReportVersion) => v.versionType === 'requirements' || v.versionType === 'both')
        .sort((a: ReportVersion, b: ReportVersion) => {
          if (a.majorVersion !== b.majorVersion) return b.majorVersion - a.majorVersion;
          if (a.minorVersion !== b.minorVersion) return b.minorVersion - a.minorVersion;
          if (b.patchVersion !== a.patchVersion) return b.patchVersion - a.patchVersion;
          // Tiebreaker: sort by createdAt descending (most recent first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })[0]
    : null;

  // WebSocket: Announce viewing presence when viewing a version
  useEffect(() => {
    if (!latestVersion || !currentUser || !isConnected) return;

    // Update activity type ref
    currentActivityTypeRef.current = isEditMode ? 'editing' : 'viewing';
    currentVersionIdRef.current = latestVersion.id;

    // Send presence announcement
    send({
      type: 'version:presence',
      payload: {
        versionId: latestVersion.id,
        reportId,
        activityType: currentActivityTypeRef.current,
        userId: currentUser.id,
        userName: currentUser.displayName
      }
    });

    // Cleanup: announce leaving when unmounting or version changes
    return () => {
      if (currentVersionIdRef.current) {
        send({
          type: 'version:leave',
          payload: {
            versionId: currentVersionIdRef.current,
            reportId,
            userId: currentUser.id
          }
        });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestVersion?.id, currentUser?.id, isEditMode, isConnected, send, reportId]);

  // WebSocket: Subscribe to edit conflicts
  useEffect(() => {
    if (!currentUser || !isConnected) return;

    const unsubscribe = subscribe('version:edit-conflict', (data: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // Only show conflict if someone else is editing the same version we're trying to edit
      if (
        data.versionId === latestVersion?.id &&
        data.reportId === reportId &&
        data.userId !== currentUser.id &&
        isEditMode
      ) {
        setEditConflict({
          user: data.userName,
          userId: data.userId,
          versionId: data.versionId
        });
        setShowEditConflictDialog(true);
      }
    });

    return unsubscribe;
  }, [subscribe, currentUser, latestVersion?.id, reportId, isEditMode, isConnected]);

  // Check if Requirements version is locked (approved or published)
  const isVersionLocked = latestVersion && (latestVersion.status === 'manager_approval' || latestVersion.status === 'published');

  const {
    aiFallbackSections,
    aiFallbackState,
    generateMutation,
    generatedCitations,
    generatedConfidence,
    generationProgress,
    handleGenerateMarketResearch,
    isGeneratingResearch,
    marketResearch,
    setShowAiFallbackChoiceDialog,
    setShowMarketResearchPanel,
    showAiFallbackChoiceDialog,
    showMarketResearchPanel,
  } = useRequirementsGeneration({
    reportId,
    queryClient,
    requirements,
    requirementsData,
    isLoading,
    isVersionLocked: Boolean(isVersionLocked),
    t,
    toast,
    setEditedRequirements,
    setBlockingGate,
  });

  // Fetch section assignments for permission checking
  const { data: assignmentsResponse } = useQuery<{
    success: boolean;
    data: Array<SectionAssignmentWithRelations>
  }>({
    queryKey: ["/api/demand-reports", reportId, "section-assignments"],
  });

  // Fetch user's assigned sections WITH status for temporary access control
  const { data: userAssignedSectionsWithStatusResponse } = useQuery<{
    success: boolean;
    data: Array<{sectionName: string, status: string}>
  }>({
    queryKey: ["/api/users", currentUser?.id, "assigned-sections-with-status", reportId],
    enabled: !!currentUser?.id,
  });

  const assignments = useMemo(() => assignmentsResponse?.data ?? [], [assignmentsResponse?.data]);
  const getSectionAssignmentForUser = useCallback(
    (sectionName: string) => getSectionAssignmentForCurrentUser(
      sectionName,
      currentUser,
      assignments,
      userAssignedSectionsWithStatusResponse?.data ?? [],
    ),
    [assignments, currentUser, userAssignedSectionsWithStatusResponse?.data],
  );

  const {
    approveVersion,
    confirmRestoreVersion,
    finalApprove,
    sendToDirector,
    submitForReview,
  } = useRequirementsVersionActions({
    reportId,
    latestVersion,
    currentUser,
    queryClient,
    refetchVersions,
    toast,
    t,
    approvalComments,
    finalApprovalComments,
    managerEmail,
    managerMessage,
    versionsData,
    latestRenderableVersion: latestVersion,
    isEditMode,
    setShowApproveDialog,
    setShowSendToDirectorDialog,
    setShowFinalApproveDialog,
    setApprovalComments,
    setFinalApprovalComments,
    setManagerEmail,
    setManagerMessage,
    setSelectedVersionForRestore,
    setConflictWarnings,
    setIsVersionLockedForRestore,
    setShowRestoreDialog,
  });

  // Version operation handlers
  const _handleViewVersion = useCallback((versionId: string) => {
    const version = versionsData?.data?.find((v: ReportVersion) => v.id === versionId);
    if (version) {
      setSelectedVersionForDetail(version);
      setShowVersionDetail(true);
    } else {
      toast({
        title: t('demand.tabs.requirements.error'),
        description: t('demand.tabs.requirements.versionNotFound'),
        variant: "destructive"
      });
    }
  }, [versionsData, toast, t]);

  const _handleCompareVersions = useCallback((versionId1: string, versionId2: string) => {
    const versionA = versionsData?.data?.find((v: ReportVersion) => v.id === versionId1);
    const versionB = versionsData?.data?.find((v: ReportVersion) => v.id === versionId2);

    if (versionA && versionB) {
      setComparisonVersions({ versionA, versionB });
      setShowVersionComparison(true);
    } else {
      toast({
        title: t('demand.tabs.requirements.error'),
        description: t('demand.tabs.requirements.couldNotLoadVersions'),
        variant: "destructive"
      });
    }
  }, [versionsData, toast, t]);

  const handleRestoreVersion = useCallback(async (versionId: string) => {
    const version = versionsData?.data?.find((item: ReportVersion) => item.id === versionId);
    if (!version) {
      toast({
        title: t('demand.tabs.requirements.error'),
        description: t('demand.tabs.requirements.versionNotFound'),
        variant: 'destructive',
      });
      return;
    }

    const warnings: string[] = [];
    const locked = version.status === 'manager_approval' || version.status === 'published';

    if (latestVersion && latestVersion.id !== versionId) {
      if (latestVersion.status === 'draft') {
        warnings.push(t('demand.tabs.requirements.draftRestoreWarning'));
      }
      if (isEditMode) {
        warnings.push(t('demand.tabs.requirements.editingRestoreWarning'));
      }
    }

    setSelectedVersionForRestore(version);
    setConflictWarnings(warnings);
    setIsVersionLockedForRestore(locked);
    setShowRestoreDialog(true);
  }, [isEditMode, latestVersion, t, toast, versionsData]);

  const {
    handleAddCapability,
    handleAddCapabilityGap: _handleAddCapabilityGap,
    handleAddFunctionalRequirement,
    handleAddNonFunctionalRequirement,
    handleAddRole,
    handleAddSecurityRequirement,
    handleDeleteCapability,
    handleDeleteCapabilityGap: _handleDeleteCapabilityGap,
    handleDeleteFunctionalRequirement,
    handleDeleteNonFunctionalRequirement,
    handleDeleteRole,
    handleDeleteSecurityRequirement,
  } = useRequirementsItemHandlers(editedRequirements, setEditedRequirements);

  const _handleDeleteTechStackItem = (category: 'frontend' | 'backend' | 'database' | 'infrastructure' | 'tools', index: number) => {
    if (!editedRequirements?.requiredTechnology) return;
    const categoryArray = editedRequirements.requiredTechnology[category] || [];
    const updated = categoryArray.filter((_, i) => i !== index);
    setEditedRequirements({
      ...editedRequirements,
      requiredTechnology: {
        ...editedRequirements.requiredTechnology,
        [category]: updated
      }
    });
  };

  const _handleDeleteResourceItem = (category: 'infrastructure', index: number) => {
    if (!editedRequirements?.requiredResources) return;
    const categoryArray = editedRequirements.requiredResources[category] || [];
    const updated = categoryArray.filter((_, i) => i !== index);
    setEditedRequirements({
      ...editedRequirements,
      requiredResources: {
        ...editedRequirements.requiredResources,
        [category]: updated,
      },
    });
  };

  const _handleAddResourceItem = (category: 'infrastructure') => {
    if (!editedRequirements) return;
    const currentResources = editedRequirements.requiredResources || {
      teamSize: '',
      budgetEstimate: '',
      timelineEstimate: '',
      infrastructure: [],
    };
    const categoryArray = currentResources[category] || [];
    const updated = [...categoryArray, ''];
    setEditedRequirements({
      ...editedRequirements,
      requiredResources: {
        ...currentResources,
        [category]: updated,
      },
    });
  };

  const _handleAddRecommendation = (category: 'industryBestPractices' | 'technologyStack' | 'architecturePatterns' | 'securityFrameworks' | 'complianceStandards') => {
    if (!editedRequirements) return;
    const currentRec = editedRequirements.worldClassRecommendations || {
      industryBestPractices: [],
      technologyStack: [],
      architecturePatterns: [],
      securityFrameworks: [],
      complianceStandards: []
    };
    const categoryArray = currentRec[category] || [];
    const updated = [...categoryArray, ''];
    setEditedRequirements({
      ...editedRequirements,
      worldClassRecommendations: {
        ...currentRec,
        [category]: updated
      }
    });
  };

  // Initialize edit data when entering edit mode
  useEffect(() => {
    if (requirementsData?.success && isEditMode && !editedRequirements) {
      setEditedRequirements(structuredClone(requirementsData.data));
      setOriginalRequirements(structuredClone(requirementsData.data));
      setChangedFields(new Set());
    }
  }, [requirementsData, isEditMode, editedRequirements]);

  // Helper function to get assignment status from section_assignments table
  const getAssignmentStatus = (sectionName: string) => {
    if (!assignmentsResponse?.success || !assignmentsResponse.data) return null;
    const assignment = assignmentsResponse.data.find(a => a.sectionName === sectionName);
    return assignment ?? null;
  };

  // Status badge configuration
  const STATUS_INFO: Record<string, { label: string; variant: BadgeVariant; icon: LucideIcon; color: string }> = {
    pending_confirmation: {
      label: t('demand.tabs.requirements.pendingConfirmation'),
      variant: "outline",
      icon: Clock,
      color: "text-yellow-600 dark:text-yellow-500"
    },
    in_progress: {
      label: t('demand.tabs.requirements.inProgress'),
      variant: "default",
      icon: Loader2,
      color: "text-blue-600 dark:text-blue-500"
    },
    under_review: {
      label: t('demand.tabs.requirements.underReview'),
      variant: "secondary",
      icon: AlertCircle,
      color: "text-purple-600 dark:text-purple-500"
    },
    completed: {
      label: t('demand.tabs.requirements.completed'),
      variant: "default",
      icon: CheckCircle2,
      color: "text-green-600 dark:text-green-500"
    },
  };

  // Helper function to render status badge for a section
  const renderStatusBadge = (sectionName: string, testId: string) => {
    const assignment = getAssignmentStatus(sectionName);
    if (!assignment) return null;

    const statusInfo = STATUS_INFO[assignment.status || 'pending_confirmation'];
    if (!statusInfo) return null;

    const StatusIcon = statusInfo.icon;
    return (
      <Badge
        variant={statusInfo.variant}
        className={statusInfo.color}
        data-testid={testId}
      >
        {StatusIcon && <StatusIcon className="h-3 w-3 mr-1" />}
        {statusInfo.label}
      </Badge>
    );
  };


  const {
    getChangeBadgeText,
    handleCancel,
    handleSaveAndExit,
    hasFieldChanged,
  } = useRequirementsDraftEditing({
    changedFields,
    currentUser,
    editedRequirements,
    isVersionLocked: Boolean(isVersionLocked),
    originalRequirements,
    queryClient,
    refetchVersions,
    reportId,
    setChangedFields,
    setEditedRequirements,
    setIsEditMode,
    setOriginalRequirements,
    t,
    toast,
    validationErrorsRef,
  });

  const rawDisplayRequirements = isEditMode ? editedRequirements : requirements;

  // Normalize all nested arrays AND map AI field names to UI field names so the renderer never
  // crashes on undefined .length and all available data is displayed.
  // IMPORTANT: This useMemo MUST be before any conditional returns to satisfy React hook rules.
  const displayRequirements = useMemo(() => {
    if (!rawDisplayRequirements) {
      return rawDisplayRequirements;
    }

    return normalizeRequirementsAnalysis(rawDisplayRequirements);
  }, [rawDisplayRequirements]);

  const requirementReferenceLabelMap = useMemo(() => {
    const referenceMap: Record<string, string> = {};

    const normalizeReferenceLabel = (value: string) => {
      const normalized = value.replace(/\s+/g, ' ').trim();
      if (!normalized) return '';

      const withoutLead = normalized
        .replace(/^(the\s+)?(?:[A-Za-z0-9/'&()-]+\s+){0,4}(shall|must|will)\s+/i, '')
        .replace(/^(shall|must|will)\s+/i, '')
        .replace(/\.$/, '');

      const compact = withoutLead.length > 78 ? `${withoutLead.slice(0, 75).trim()}...` : withoutLead;
      return compact.charAt(0).toUpperCase() + compact.slice(1);
    };

    const register = (referenceId: string | undefined, label: string | undefined | null) => {
      if (!referenceId || !label) return;
      const normalized = normalizeReferenceLabel(label);
      if (!normalized) return;
      referenceMap[referenceId] = `${referenceId} · ${normalized}`;
    };

    displayRequirements?.functionalRequirements?.forEach((requirement) => {
      register(requirement.id, requirement.requirement || requirement.description || requirement.bestPractice);
    });
    displayRequirements?.nonFunctionalRequirements?.forEach((requirement) => {
      register(requirement.id, requirement.requirement || requirement.metric || requirement.bestPractice);
    });
    displayRequirements?.securityRequirements?.forEach((requirement) => {
      register(requirement.id, requirement.requirement || requirement.implementation || requirement.compliance);
    });
    displayRequirements?.integrations?.forEach((integration) => {
      register(integration.id, integration.name);
    });
    displayRequirements?.operationalRequirements?.forEach((workflow) => {
      register(workflow.id, workflow.workflow);
    });

    return referenceMap;
  }, [displayRequirements]);

  const hasDeliveryLayerContent = Boolean(
    displayRequirements
    && (
      (displayRequirements.integrations && displayRequirements.integrations.length > 0)
      || (displayRequirements.phasePlan && displayRequirements.phasePlan.length > 0)
      || (displayRequirements.operationalRequirements && displayRequirements.operationalRequirements.length > 0)
    )
  );
  const securityGovernanceSignals = useMemo(() => {
    const securityRequirements = displayRequirements?.securityRequirements || [];
    const signalDefinitions: Array<{
      label: string;
      present: (requirement: RequirementsAnalysis['securityRequirements'][number]) => boolean;
    }> = [
      { label: 'KMS / HSM', present: (requirement) => Boolean(requirement.keyManagement || requirement.keyRotation) },
      { label: 'Audit retention', present: (requirement) => Boolean(requirement.auditRetention || requirement.logging) },
      { label: 'PAM', present: (requirement) => Boolean(requirement.privilegedAccess) },
      { label: 'Secrets', present: (requirement) => Boolean(requirement.secretsManagement) },
      { label: 'Model security', present: (requirement) => Boolean(requirement.modelSecurity) },
      { label: 'Data masking', present: (requirement) => Boolean(requirement.dataMasking) },
      { label: 'Incident severity', present: (requirement) => Boolean(requirement.incidentSeverity || requirement.incidentResponse) },
    ];

    return signalDefinitions
      .filter(({ present }) => securityRequirements.some(present))
      .map(({ label }) => label);
  }, [displayRequirements]);

  const requirementsVersionSheet = !isFullscreen ? (
    <Suspense fallback={null}>
      <DetailedRequirementsVersionSheet
        open={showVersionSheet}
        onOpenChange={setShowVersionSheet}
        latestVersion={latestVersion}
        isEditMode={isEditMode}
        canApprove={reportAccess.canApprove}
        canFinalApprove={reportAccess.canFinalApprove}
        onOpenApproveDialog={() => setShowApproveDialog(true)}
        onOpenSendToDirectorDialog={() => setShowSendToDirectorDialog(true)}
        onOpenFinalApproveDialog={() => setShowFinalApproveDialog(true)}
        isFinalApprovePending={finalApprove.isPending}
        isVersionLocked={Boolean(isVersionLocked)}
        renderStatusBadge={(status: string) => getRequirementsStatusBadge(status, t)}
        showVersionPanel={showVersionPanel}
        onToggleVersionPanel={() => setShowVersionPanel(!showVersionPanel)}
        onSubmitForReview={() => submitForReview.mutate()}
        isSubmitForReviewPending={submitForReview.isPending}
        onStartEditing={() => setIsEditMode(true)}
        reportId={reportId}
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        onOpenBranchTree={() => setShowBranchTree(true)}
        onOpenMergeDialog={() => setShowMergeDialog(true)}
        versions={versionsData?.data ?? []}
        onViewVersion={_handleViewVersion}
        onCompareVersions={_handleCompareVersions}
        onRestoreVersion={handleRestoreVersion}
      />
    </Suspense>
  ) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('demand.tabs.requirements.loadingRequirementsAnalysis')}</p>
        </div>
      </div>
    );
  }

  // Check workflow status - gate access
  // Requirements tab unlocks only AFTER demand information is acknowledged
  const workflowStatus = reportData?.data?.workflowStatus || 'generated';
  const isDemandAcknowledged = workflowStatus !== 'generated' && workflowStatus !== 'deferred' && workflowStatus !== 'rejected';

  if (!isDemandAcknowledged) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <Card className="m-6 border-2 border-amber-300 dark:border-amber-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Shield className="h-5 w-5" />
              {t('demand.tabs.requirements.detailedRequirementsTabLocked')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('demand.tabs.requirements.tabLockedDescription')}
            </p>
            <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t('demand.tabs.requirements.currentStatus')}:
              </h4>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                {t('demand.tabs.requirements.demandNotAcknowledged')}
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                {t('demand.tabs.requirements.navigateToDemandInfo')}
              </p>
              <ol className="mt-2 space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                <li>{t('demand.tabs.requirements.reviewDemandDetails')}</li>
                <li>{t('demand.tabs.requirements.clickAcknowledgeRequest')}</li>
                <li>{t('demand.tabs.requirements.onceAcknowledgedUnlock')}</li>
              </ol>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>{t('demand.tabs.requirements.ensuresWorkflowAudit')}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!requirements) {
    return (
      <>
        <div className="flex gap-4 h-full" data-testid="tabcontent-detailed-requirements-empty">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden p-6">
            {/* Requirements Header with Version Status and Controls - Always Visible */}
            <DetailedRequirementsEmptyStateHeader
              latestVersion={latestVersion}
              latestVersionStatusBadge={latestVersion ? getRequirementsStatusBadge(latestVersion.status, t) : null}
              showVersionSheet={showVersionSheet}
              onToggleVersionSheet={() => setShowVersionSheet(!showVersionSheet)}
              canSubmitForReview={reportAccess.canSubmitForReview}
              isSubmitForReviewPending={submitForReview.isPending}
              onSubmitForReview={() => submitForReview.mutate()}
              canApprove={reportAccess.canApprove}
              onApprove={() => setShowApproveDialog(true)}
              canFinalApprove={reportAccess.canFinalApprove}
              isFinalApprovePending={finalApprove.isPending}
              onFinalApprove={() => setShowFinalApproveDialog(true)}
            />
            <DetailedRequirementsEmptyState
              isGenerating={generateMutation.isPending}
              generationProgress={generationProgress}
            />
          </div>
        </div>
        {requirementsVersionSheet}
      </>
    );
  }

  const showBrainApprovalButton = actionItems.length > 0;
  const currentVersionLabel = latestVersion?.versionNumber == null
    ? '0'
    : String(latestVersion.versionNumber).trim();
  const displayVersionLabel = /^v/i.test(currentVersionLabel)
    ? currentVersionLabel
    : `v${currentVersionLabel}`;
  const requirementsRailCardClass = "overflow-hidden rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_18px_45px_-38px_rgba(15,23,42,0.55)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.9))]";
  const requirementsRailHeaderClass = "border-b border-slate-200/70 bg-white/70 px-3 py-2.5 dark:border-slate-800/70 dark:bg-slate-950/30";
  const requirementsRailBodyClass = "space-y-3 p-3";
  const requirementsRailInsetClass = "rounded-xl border border-slate-200/70 bg-white/75 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/50";
  const requirementsRailStatCardClass = "rounded-xl border border-slate-200/70 bg-white/75 p-2 dark:border-slate-800/70 dark:bg-slate-900/50";
  const requirementsRailLabelClass = "text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";
  const requirementsRailValueClass = "mt-1 text-xs font-semibold text-slate-900 dark:text-slate-50";
  const reportIdentity = reportData?.data as { title?: string; organizationName?: string; department?: string } | undefined;
  const resourcesAssignment = getSectionAssignmentForUser(REQUIREMENTS_SECTIONS.RESOURCES);
  const rolesAssignment = getSectionAssignmentForUser(REQUIREMENTS_SECTIONS.ROLES);
  const recommendationsAssignment = getSectionAssignmentForUser(REQUIREMENTS_SECTIONS.RECOMMENDATIONS);

  const buildSectionGovernance = (sectionName: string, sectionLabel: string, testId: string) => {
    const assignment = getSectionAssignmentForUser(sectionName);

    return {
      statusControls: !isEditMode ? (
        <>
          {renderStatusBadge(sectionName, testId)}
          <Can permissions={["requirements:assign-sections"]}>
            <SectionAssignmentPopover
              reportId={reportId}
              sectionName={sectionName}
              sectionLabel={sectionLabel}
            />
          </Can>
        </>
      ) : null,
      assignmentPanel: (!isEditMode && assignment && currentUser) ? (
        <AssignmentStatusPanel
          reportId={reportId}
          sectionName={sectionName}
          assignment={assignment}
          currentUserId={currentUser.id}
        />
      ) : null,
    };
  };

  const enhancedSectionGovernance = {
    phasePlan: buildSectionGovernance(REQUIREMENTS_SECTIONS.PHASE_PLAN, 'Delivery Roadmap', 'badge-status-phasePlan'),
    integrations: buildSectionGovernance(REQUIREMENTS_SECTIONS.INTEGRATIONS, 'Integration Landscape', 'badge-status-integrations'),
    operationalRequirements: buildSectionGovernance(REQUIREMENTS_SECTIONS.OPERATIONS, 'Operational Workflows', 'badge-status-operationalRequirements'),
    dataRequirements: buildSectionGovernance(REQUIREMENTS_SECTIONS.DATA_REQUIREMENTS, 'Data Governance & Reporting', 'badge-status-dataRequirements'),
    businessOutcomes: buildSectionGovernance(REQUIREMENTS_SECTIONS.BUSINESS_OUTCOMES, 'Business Outcome Traceability', 'badge-status-businessOutcomes'),
    traceabilityMatrix: buildSectionGovernance(REQUIREMENTS_SECTIONS.TRACEABILITY, 'Requirement Lineage Matrix', 'badge-status-traceabilityMatrix'),
    assumptionsConstraints: buildSectionGovernance(REQUIREMENTS_SECTIONS.PLANNING_BOUNDS, 'Planning Assumptions & Delivery Boundaries', 'badge-status-assumptionsConstraints'),
  };

  const governanceShellProps: DetailedRequirementsGovernanceShellProps = {
    reportId,
    reportTitle: String(reportIdentity?.title || t('demand.analysis.workflowTimeline.demandAnalysisReport')),
    organizationName: String(reportIdentity?.organizationName || ''),
    department: String(reportIdentity?.department || ''),
    isEditMode,
    latestVersion,
    displayVersionLabel,
    showVersionSheet,
    onToggleVersionSheet: () => setShowVersionSheet(!showVersionSheet),
    isSubmitForReviewPending: submitForReview.isPending,
    onSubmitForReview: () => submitForReview.mutate(),
    canApprove: reportAccess.canApprove,
    onApprove: () => setShowApproveDialog(true),
    onSendToDirector: () => setShowSendToDirectorDialog(true),
    isFinalApprovePending: finalApprove.isPending,
    onFinalApprove: () => setShowFinalApproveDialog(true),
    requirementsAvailable: Boolean(requirementsData?.data),
    onEnterEditMode: () => setIsEditMode(true),
    onSaveAndExit: () => { void handleSaveAndExit(changedFields); },
    onCancelEdit: handleCancel,
  };

  const decisionRibbonProps: DetailedRequirementsDecisionRibbonProps | null = brainDecisionId ? {
    brainDecisionId,
    statusBadgeClass: brainStatus.badgeClass,
    statusLabel: brainStatus.label,
    classification: effectiveClassification,
    nextGate: brainStatus.nextGate,
    classificationConfidence,
    engineSummary,
    decisionSource,
    showBrainApprovalButton,
    onOpenGovernance: () => setShowBrainGovernance(true),
    onOpenApproval: () => setShowBrainApproval(true),
  } : null;

  return (
    <div className={`flex flex-col w-full ${isFullscreen ? 'min-h-full overflow-visible' : 'h-[calc(100vh-4rem)] overflow-hidden'}`}>
      <DetailedRequirementsStatusBanner latestVersion={latestVersion} blockingGate={blockingGate} />

      <div className="relative flex flex-1 w-full min-h-0 overflow-hidden" data-testid="tabcontent-detailed-requirements">
        {/* Intelligence Rail hot-zone trigger (hidden in fullscreen) */}
        {!isFullscreen && !showVersionComparison && !showIntelligenceRail && (
          <div
            className="group absolute left-0 top-0 z-30 flex h-full w-3 cursor-pointer flex-col items-center justify-center border-r border-transparent bg-transparent transition-all duration-200 hover:w-5 hover:border-sky-300/40 hover:bg-gradient-to-r hover:from-sky-500/10 hover:via-cyan-500/10 hover:to-transparent dark:hover:border-sky-400/30 dark:hover:from-sky-500/15 dark:hover:via-cyan-500/10"
            onMouseEnter={() => setShowIntelligenceRail(true)}
            onClick={() => setShowIntelligenceRail(true)}
            data-testid="button-show-intelligence-rail-requirements"
            role="button"
            tabIndex={0}
            aria-label="Show Intelligence Panel"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setShowIntelligenceRail(true);
              }
            }}
          >
            <span
              className="pointer-events-none flex h-16 w-1 items-center justify-center rounded-full bg-gradient-to-b from-sky-400 via-cyan-500 to-teal-500 opacity-60 shadow-[0_0_12px_rgba(14,165,233,0.55)] transition-all duration-200 group-hover:h-20 group-hover:w-1.5 group-hover:opacity-100 group-hover:shadow-[0_0_18px_rgba(14,165,233,0.85)] dark:from-sky-300 dark:via-cyan-400 dark:to-teal-400"
              aria-hidden="true"
            />
            <span className="sr-only">Show Intelligence Panel</span>
          </div>
        )}

        {/* Professional Intelligence Rail - Left Side (Collapsible) - hidden in fullscreen */}
        {!isFullscreen && !showVersionComparison && showIntelligenceRail && (
          <Suspense fallback={null}>
            <DetailedRequirementsIntelligenceRail
              governanceShellProps={governanceShellProps}
              decisionRibbonProps={decisionRibbonProps}
              requirementsRailCardClass={requirementsRailCardClass}
              requirementsRailHeaderClass={requirementsRailHeaderClass}
              requirementsRailBodyClass={requirementsRailBodyClass}
              requirementsRailInsetClass={requirementsRailInsetClass}
              requirementsRailStatCardClass={requirementsRailStatCardClass}
              requirementsRailLabelClass={requirementsRailLabelClass}
              requirementsRailValueClass={requirementsRailValueClass}
              latestVersion={latestVersion}
              reportId={reportId}
              displayVersionLabel={displayVersionLabel}
              latestVersionStatusBadge={latestVersion ? getRequirementsStatusBadge(latestVersion.status, t) : null}
              versions={versionsData?.data}
              displayRequirements={displayRequirements}
              assignments={assignments}
              marketResearch={marketResearch}
              isGeneratingResearch={isGeneratingResearch}
              onGenerateMarketResearch={handleGenerateMarketResearch}
              onOpenMarketResearchPanel={() => setShowMarketResearchPanel(true)}
              onHideRail={() => setShowIntelligenceRail(false)}
            />
          </Suspense>
        )}

        {/* Professional Adaptive Canvas - Center */}
        {!showVersionComparison && (
          <div className={`flex-1 min-h-0 flex flex-col ${isFullscreen ? 'overflow-visible' : 'overflow-hidden'} bg-background/50 relative`}>
            <DetailedRequirementsDocumentChrome latestVersion={latestVersion} isVersionLocked={Boolean(isVersionLocked)} />

            {/* Scrollable Content Section */}
            <div className={`${isFullscreen ? '' : 'flex-1 min-h-0 overflow-y-auto'} p-6 space-y-6`}>

          <DetailedRequirementsAiMetadata
            generatedConfidence={generatedConfidence}
            generatedCitations={generatedCitations}
          />

          {/* Main Content Layout — 4-layer decision flow (Baseline / Delivery / Governance / Readiness) */}
          <div className="space-y-6">
            <Tabs
              value={requirementsLayer}
              onValueChange={(value) => setRequirementsLayer(value as RequirementsLayerKey)}
              className="flex min-h-0 w-full min-w-0 flex-col"
            >
              <div className="overflow-x-auto pb-1">
                <TabsList className="inline-flex min-w-max h-auto gap-2 rounded-xl border bg-muted/40 p-2">
                  <TabsTrigger
                    value="baseline"
                    className="min-w-[10rem] justify-start gap-2 rounded-lg border border-transparent px-3 text-xs sm:text-sm data-[state=active]:border-blue-500/40 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-sm"
                    data-testid="requirements-layer-tab-baseline"
                  >
                    <Target className="h-4 w-4" /> Layer 1 · Baseline
                  </TabsTrigger>
                  <TabsTrigger
                    value="delivery"
                    className="min-w-[10rem] justify-start gap-2 rounded-lg border border-transparent px-3 text-xs sm:text-sm data-[state=active]:border-amber-500/40 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300 data-[state=active]:shadow-sm"
                    data-testid="requirements-layer-tab-delivery"
                  >
                    <Clock className="h-4 w-4" /> Layer 2 · Delivery
                  </TabsTrigger>
                  <TabsTrigger
                    value="governance"
                    className="min-w-[10rem] justify-start gap-2 rounded-lg border border-transparent px-3 text-xs sm:text-sm data-[state=active]:border-emerald-500/40 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 data-[state=active]:shadow-sm"
                    data-testid="requirements-layer-tab-governance"
                  >
                    <ShieldCheck className="h-4 w-4" /> Layer 3 · Governance
                  </TabsTrigger>
                  <TabsTrigger
                    value="readiness"
                    className="min-w-[11rem] justify-start gap-2 rounded-lg border border-transparent px-3 text-xs sm:text-sm data-[state=active]:border-violet-500/40 data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300 data-[state=active]:shadow-sm"
                    data-testid="requirements-layer-tab-readiness"
                  >
                    <BookOpen className="h-4 w-4" /> Layer 4 · Readiness
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* LAYER 1 — BASELINE: Capabilities / FR / NFR / SR */}
              <TabsContent value="baseline" className="mt-4 min-h-0 min-w-0 space-y-6 overflow-x-hidden rounded-xl border bg-background/40 p-3">
                <Suspense fallback={null}>
                  <DetailedRequirementsCoreSections
                    reportId={reportId}
                    displayRequirements={displayRequirements}
                    isEditMode={isEditMode}
                    highlightedSection={highlightedSection}
                    currentUser={currentUser}
                    latestVersion={latestVersion}
                    hasFieldChanged={hasFieldChanged}
                    getChangeBadgeText={getChangeBadgeText}
                    getPriorityColor={getPriorityColor}
                    renderStatusBadge={renderStatusBadge}
                    getSectionAssignmentForUser={(sectionName) => getSectionAssignmentForUser(sectionName)}
                    onUpdateCapability={(index, patch) => {
                      if (!displayRequirements?.capabilities) return;
                      const updated = [...displayRequirements.capabilities];
                      const currentItem = updated[index];
                      if (!currentItem) return;
                      updated[index] = { ...currentItem, ...patch };
                      setEditedRequirements({ ...displayRequirements, capabilities: updated });
                    }}
                    onDeleteCapability={handleDeleteCapability}
                    onAddCapability={handleAddCapability}
                    onUpdateFunctionalRequirement={(index, patch) => {
                      if (!displayRequirements?.functionalRequirements) return;
                      const updated = [...displayRequirements.functionalRequirements];
                      const currentItem = updated[index];
                      if (!currentItem) return;
                      updated[index] = { ...currentItem, ...patch };
                      setEditedRequirements({ ...displayRequirements, functionalRequirements: updated });
                    }}
                    onDeleteFunctionalRequirement={handleDeleteFunctionalRequirement}
                    onAddFunctionalRequirement={handleAddFunctionalRequirement}
                    onUpdateNonFunctionalRequirement={(index, patch) => {
                      if (!displayRequirements?.nonFunctionalRequirements) return;
                      const updated = [...displayRequirements.nonFunctionalRequirements];
                      const currentItem = updated[index];
                      if (!currentItem) return;
                      updated[index] = { ...currentItem, ...patch };
                      setEditedRequirements({ ...displayRequirements, nonFunctionalRequirements: updated });
                    }}
                    onDeleteNonFunctionalRequirement={handleDeleteNonFunctionalRequirement}
                    onAddNonFunctionalRequirement={handleAddNonFunctionalRequirement}
                    onUpdateSecurityRequirement={(index, patch) => {
                      if (!displayRequirements?.securityRequirements) return;
                      const updated = [...displayRequirements.securityRequirements];
                      const currentItem = updated[index];
                      if (!currentItem) return;
                      updated[index] = { ...currentItem, ...patch };
                      setEditedRequirements({ ...displayRequirements, securityRequirements: updated });
                    }}
                    onDeleteSecurityRequirement={handleDeleteSecurityRequirement}
                    onAddSecurityRequirement={handleAddSecurityRequirement}
                    PrioritySparkline={PrioritySparkline}
                    SectionProvenanceTags={SectionProvenanceTags}
                    DataGovernanceIndicators={DataGovernanceIndicators}
                  />
                </Suspense>
              </TabsContent>

              {/* LAYER 2 — DELIVERY: Phases / Integrations / Workflows */}
              <TabsContent value="delivery" className="mt-4 min-h-0 min-w-0 space-y-6 overflow-x-hidden rounded-xl border bg-background/40 p-3">
                {displayRequirements && (
                  <Suspense fallback={null}>
                    <DetailedRequirementsEnhancedSections
                      integrations={displayRequirements.integrations}
                      operationalRequirements={displayRequirements.operationalRequirements}
                      phasePlan={displayRequirements.phasePlan}
                      highlightedSection={highlightedSection}
                      requirementLabelMap={requirementReferenceLabelMap}
                      sectionGovernance={enhancedSectionGovernance}
                    />
                  </Suspense>
                )}
                {!hasDeliveryLayerContent && (
                  <Card className="border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,0.98))] dark:border-amber-900/70 dark:bg-[linear-gradient(180deg,rgba(69,26,3,0.32),rgba(15,23,42,0.96))]">
                    <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                            Delivery decomposition needs enrichment
                          </p>
                          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Make the implementation path explicit with phased scope, integration contracts, and operational workflow controls before approval.
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200">
                        Layer 2 gap
                      </Badge>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* LAYER 3 — GOVERNANCE: Data / Security / Traceability */}
              <TabsContent value="governance" className="mt-4 min-h-0 min-w-0 space-y-6 overflow-x-hidden rounded-xl border bg-background/40 p-3">
                {displayRequirements?.securityRequirements && displayRequirements.securityRequirements.length > 0 && (
                  <Card className="border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] shadow-[0_18px_40px_-34px_rgba(15,23,42,0.4)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.9))]">
                    <CardContent className="flex flex-col gap-4 p-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-200">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                              Security governance posture is retained
                            </p>
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-200">
                              {displayRequirements.securityRequirements.length} SR controls
                            </Badge>
                          </div>
                          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                            The full security requirements remain intact in the baseline section. This governance view makes the approval signals explicit so security does not disappear behind the tab split.
                          </p>
                          {securityGovernanceSignals.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {securityGovernanceSignals.map((signal) => (
                                <Badge
                                  key={signal}
                                  variant="secondary"
                                  className="rounded-full bg-slate-900/5 text-slate-700 hover:bg-slate-900/5 dark:bg-slate-50/10 dark:text-slate-200"
                                >
                                  {signal}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-800/80 dark:bg-slate-950/50 xl:max-w-xs">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          Approval focus
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                          Review data control, cross-cutting security evidence, and traceability together so governance remains board-defensible.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {displayRequirements && (
                  <Suspense fallback={null}>
                    <DetailedRequirementsEnhancedSections
                      dataRequirements={displayRequirements.dataRequirements}
                      businessOutcomes={displayRequirements.businessOutcomes}
                      traceabilityMatrix={displayRequirements.traceabilityMatrix}
                      highlightedSection={highlightedSection}
                      requirementLabelMap={requirementReferenceLabelMap}
                      sectionGovernance={enhancedSectionGovernance}
                    />
                  </Suspense>
                )}
              </TabsContent>

              {/* LAYER 4 — READINESS: Resources / Assumptions / Roles */}
              <TabsContent value="readiness" className="mt-4 min-h-0 min-w-0 space-y-6 overflow-x-hidden rounded-xl border bg-background/40 p-3">
                {displayRequirements && (
                  <Suspense fallback={null}>
                    <DetailedRequirementsEnhancedSections
                      assumptions={displayRequirements.assumptions}
                      constraints={displayRequirements.constraints}
                      dependencies={displayRequirements.dependencies}
                      outOfScope={displayRequirements.outOfScope}
                      highlightedSection={highlightedSection}
                      requirementLabelMap={requirementReferenceLabelMap}
                      sectionGovernance={enhancedSectionGovernance}
                    />
                  </Suspense>
                )}

                {/* Required Resources */}
                {displayRequirements?.requiredResources && (
                  displayRequirements.requiredResources.teamSize ||
                  displayRequirements.requiredResources.budgetEstimate ||
                  displayRequirements.requiredResources.timelineEstimate ||
                  (displayRequirements.requiredResources.infrastructure && displayRequirements.requiredResources.infrastructure.length > 0)
                ) && (
                  <DetailedRequirementsRequiredResources
                    requiredResources={displayRequirements.requiredResources}
                    isEditMode={isEditMode}
                    highlightedSection={highlightedSection}
                    hasFieldChanged={hasFieldChanged('requiredResources')}
                    changeBadgeText={getChangeBadgeText('requiredResources')}
                    statusControls={(
                      <>
                        {renderStatusBadge(REQUIREMENTS_SECTIONS.RESOURCES, "badge-status-requiredResources")}
                        <Can permissions={["requirements:assign-sections"]}>
                          <SectionAssignmentPopover
                            reportId={reportId}
                            sectionName={REQUIREMENTS_SECTIONS.RESOURCES}
                            sectionLabel={t('demand.tabs.requirements.requiredResources')}
                          />
                        </Can>
                      </>
                    )}
                    assignmentPanel={(!isEditMode && resourcesAssignment && currentUser) ? (
                      <AssignmentStatusPanel
                        reportId={reportId}
                        sectionName={REQUIREMENTS_SECTIONS.RESOURCES}
                        assignment={resourcesAssignment}
                        currentUserId={currentUser.id}
                      />
                    ) : null}
                    onChangeField={(patch) => {
                      const currentResources = displayRequirements.requiredResources;
                      if (!currentResources) return;
                      setEditedRequirements({
                        ...displayRequirements,
                        requiredResources: {
                          ...currentResources,
                          ...patch,
                        },
                      });
                    }}
                  />
                )}

                {/* Roles & Responsibilities */}
                {displayRequirements?.rolesAndResponsibilities && displayRequirements.rolesAndResponsibilities.length > 0 && (
                  <DetailedRequirementsRoles
                    roles={displayRequirements.rolesAndResponsibilities}
                    isEditMode={isEditMode}
                    highlightedSection={highlightedSection}
                    hasFieldChanged={hasFieldChanged('rolesAndResponsibilities')}
                    changeBadgeText={getChangeBadgeText('rolesAndResponsibilities')}
                    statusControls={(
                      <>
                        {renderStatusBadge(REQUIREMENTS_SECTIONS.ROLES, "badge-status-rolesResponsibilities")}
                        <Can permissions={["requirements:assign-sections"]}>
                          <SectionAssignmentPopover
                            reportId={reportId}
                            sectionName={REQUIREMENTS_SECTIONS.ROLES}
                            sectionLabel={t('demand.tabs.requirements.rolesAndResponsibilities')}
                          />
                        </Can>
                      </>
                    )}
                    assignmentPanel={(!isEditMode && rolesAssignment && currentUser) ? (
                      <AssignmentStatusPanel
                        reportId={reportId}
                        sectionName={REQUIREMENTS_SECTIONS.ROLES}
                        assignment={rolesAssignment}
                        currentUserId={currentUser.id}
                      />
                    ) : null}
                    onUpdateRole={(index, patch) => {
                      const roles = displayRequirements.rolesAndResponsibilities;
                      if (!roles) return;
                      const updated = [...roles];
                      const currentItem = updated[index];
                      if (!currentItem) return;
                      updated[index] = { ...currentItem, ...patch };
                      setEditedRequirements({ ...displayRequirements, rolesAndResponsibilities: updated });
                    }}
                    onDeleteRole={handleDeleteRole}
                    onAddRole={handleAddRole}
                  />
                )}

                {/* World-Class Recommendations */}
                {displayRequirements?.worldClassRecommendations && (
                  (displayRequirements.worldClassRecommendations.architecturePatterns && displayRequirements.worldClassRecommendations.architecturePatterns.length > 0) ||
                  (displayRequirements.worldClassRecommendations.securityFrameworks && displayRequirements.worldClassRecommendations.securityFrameworks.length > 0) ||
                  (displayRequirements.worldClassRecommendations.complianceStandards && displayRequirements.worldClassRecommendations.complianceStandards.length > 0)
                ) && (
              <Card
                id="section-worldClassRecommendations"
                className={`${hasFieldChanged('worldClassRecommendations') && isEditMode ? 'ring-2 ring-primary' : ''} ${highlightedSection === 'worldClassRecommendations' ? 'ring-4 ring-primary ring-offset-2 ring-offset-background shadow-2xl' : ''}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-2">
                      <CardTitle className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        {t('demand.tabs.requirements.worldClassRecommendations')}
                        {hasFieldChanged('worldClassRecommendations') && isEditMode && (
                          <Badge variant="default" className="ml-2">{getChangeBadgeText('worldClassRecommendations')}</Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{t('demand.tabs.requirements.worldClassDescription')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditMode && (
                        <>
                          {renderStatusBadge(REQUIREMENTS_SECTIONS.RECOMMENDATIONS, "badge-status-worldClassRecommendations")}
                          <Can permissions={["requirements:assign-sections"]}>
                            <SectionAssignmentPopover
                              reportId={reportId}
                              sectionName={REQUIREMENTS_SECTIONS.RECOMMENDATIONS}
                              sectionLabel={t('demand.tabs.requirements.worldClassRecommendations')}
                            />
                          </Can>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">

                  {!isEditMode && recommendationsAssignment && currentUser && (
                    <AssignmentStatusPanel
                      reportId={reportId}
                      sectionName={REQUIREMENTS_SECTIONS.RECOMMENDATIONS}
                      assignment={recommendationsAssignment}
                      currentUserId={currentUser.id}
                    />
                  )}
                  {isEditMode ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.architecturePatterns')}</Label>
                        <Textarea
                          value={displayRequirements.worldClassRecommendations.architecturePatterns?.join('\n') || ''}
                          onChange={(e) => {
                            const recommendations = displayRequirements.worldClassRecommendations;
                            if (!recommendations) return;
                            setEditedRequirements({
                              ...displayRequirements,
                              worldClassRecommendations: {
                                industryBestPractices: recommendations.industryBestPractices,
                                technologyStack: recommendations.technologyStack,
                                architecturePatterns: e.target.value.split('\n').filter(p => p.trim()),
                                securityFrameworks: recommendations.securityFrameworks,
                                complianceStandards: recommendations.complianceStandards,
                              }
                            });
                          }}
                          className="min-h-[80px]"
                          data-testid="textarea-architecture-patterns"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.securityFrameworks')}</Label>
                        <Textarea
                          value={displayRequirements.worldClassRecommendations.securityFrameworks?.join('\n') || ''}
                          onChange={(e) => {
                            const recommendations = displayRequirements.worldClassRecommendations;
                            if (!recommendations) return;
                            setEditedRequirements({
                              ...displayRequirements,
                              worldClassRecommendations: {
                                industryBestPractices: recommendations.industryBestPractices,
                                technologyStack: recommendations.technologyStack,
                                architecturePatterns: recommendations.architecturePatterns,
                                securityFrameworks: e.target.value.split('\n').filter(f => f.trim()),
                                complianceStandards: recommendations.complianceStandards,
                              }
                            });
                          }}
                          className="min-h-[80px]"
                          data-testid="textarea-security-frameworks"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.complianceStandards')}</Label>
                        <Textarea
                          value={displayRequirements.worldClassRecommendations.complianceStandards?.join('\n') || ''}
                          onChange={(e) => {
                            const recommendations = displayRequirements.worldClassRecommendations;
                            if (!recommendations) return;
                            setEditedRequirements({
                              ...displayRequirements,
                              worldClassRecommendations: {
                                industryBestPractices: recommendations.industryBestPractices,
                                technologyStack: recommendations.technologyStack,
                                architecturePatterns: recommendations.architecturePatterns,
                                securityFrameworks: recommendations.securityFrameworks,
                                complianceStandards: e.target.value.split('\n').filter(s => s.trim()),
                              }
                            });
                          }}
                          className="min-h-[80px]"
                          data-testid="textarea-compliance-standards"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {displayRequirements.worldClassRecommendations.architecturePatterns && displayRequirements.worldClassRecommendations.architecturePatterns.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Target className="h-4 w-4 text-purple-500" />
                            {t('demand.tabs.requirements.architecturePatterns')}
                          </h4>
                          <ul className="space-y-1 pl-6">
                            {displayRequirements.worldClassRecommendations.architecturePatterns.map((pattern: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                              <li key={String(pattern)} className="text-sm text-muted-foreground list-disc">{pattern}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {displayRequirements.worldClassRecommendations.securityFrameworks && displayRequirements.worldClassRecommendations.securityFrameworks.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-red-500" />
                            {t('demand.tabs.requirements.securityFrameworks')}
                          </h4>
                          <ul className="space-y-1 pl-6">
                            {displayRequirements.worldClassRecommendations.securityFrameworks.map((framework: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                              <li key={String(framework)} className="text-sm text-muted-foreground list-disc">{framework}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {displayRequirements.worldClassRecommendations.complianceStandards && displayRequirements.worldClassRecommendations.complianceStandards.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-amber-500" />
                            {t('demand.tabs.requirements.complianceStandards')}
                          </h4>
                          <ul className="space-y-1 pl-6">
                            {displayRequirements.worldClassRecommendations.complianceStandards.map((standard: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                              <li key={String(standard)} className="text-sm text-muted-foreground list-disc">{standard}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
              </TabsContent>
            </Tabs>

          </div>
          {/* End Scrollable Content Section */}
        </div>
      </div>
        )}

      </div>

      <DetailedRequirementsMarketResearchSheet
        open={showMarketResearchPanel}
        onOpenChange={setShowMarketResearchPanel}
        marketResearch={marketResearch}
      />

      <DetailedRequirementsBrainGovernanceDrawer
        open={showBrainGovernance}
        onOpenChange={setShowBrainGovernance}
        t={t}
        brainDecisionId={brainDecisionId}
        decisionSource={decisionSource}
        brainStatus={brainStatus}
        classification={effectiveClassification}
        classificationConfidence={classificationConfidence}
      />

      <DetailedRequirementsBrainApprovalDrawer
        open={showBrainApproval}
        onOpenChange={setShowBrainApproval}
        t={t}
        brainDecisionId={brainDecisionId}
        brainStatus={brainStatus}
        brainApprovalAction={brainApprovalAction}
        onBrainApprovalActionChange={setBrainApprovalAction}
        actionItems={actionItems}
        selectedActionKeys={selectedActionKeys}
        onSelectAllActions={() => setSelectedActionKeys(actionItems.map((item) => item.key))}
        onActionCheckedChange={(key, checked) => {
          setSelectedActionKeys((prev) => (
            checked
              ? [...prev, key]
              : prev.filter((existingKey) => existingKey !== key)
          ));
        }}
        brainApprovalNotes={brainApprovalNotes}
        onBrainApprovalNotesChange={setBrainApprovalNotes}
        onSubmitApproval={() => brainApprovalMutation.mutate({
          action: brainApprovalAction,
          reason: brainApprovalNotes
        })}
        isSubmittingApproval={brainApprovalMutation.isPending}
        canSubmitApproval={Boolean(brainDecisionId)}
        showExecuteActions={((brainDecision as Record<string, unknown> | undefined)?.status === "action_execution")}
        onExecuteActions={() => executeActionsMutation.mutate()}
        isExecutingActions={executeActionsMutation.isPending}
        canExecuteActions={Boolean(((brainDecision as Record<string, unknown> | undefined)?.approval as Record<string, unknown> | undefined)?.approvalId || lastApprovalId)}
        executionReceipts={(((brainDecision as Record<string, unknown> | undefined)?.actionExecutions as Array<Record<string, unknown>> | undefined) || [])}
      />

      {requirementsVersionSheet}

      <Suspense fallback={null}>
        <DetailedRequirementsDialogs
          showAiFallbackChoiceDialog={showAiFallbackChoiceDialog}
          onAiFallbackChoiceDialogOpenChange={setShowAiFallbackChoiceDialog}
          aiFallbackSections={aiFallbackSections}
          aiFallbackState={aiFallbackState}
          onRetryAiOnly={() => {
            setShowAiFallbackChoiceDialog(false);
            generateMutation.mutate({
              generationMode: 'ai_only',
              skipPrompt: true,
            });
          }}
          onContinueAsTemplate={() => {
            setShowAiFallbackChoiceDialog(false);
            generateMutation.mutate({
              generationMode: 'allow_fallback_template',
              skipPrompt: true,
            });
          }}
          showApproveDialog={showApproveDialog}
          onApproveDialogOpenChange={setShowApproveDialog}
          approvalComments={approvalComments}
          onApprovalCommentsChange={setApprovalComments}
          onApprove={() => approveVersion.mutate()}
          isApproving={approveVersion.isPending}
          showSendToDirectorDialog={showSendToDirectorDialog}
          onSendToDirectorDialogOpenChange={setShowSendToDirectorDialog}
          managerEmail={managerEmail}
          onManagerEmailChange={setManagerEmail}
          managerMessage={managerMessage}
          onManagerMessageChange={setManagerMessage}
          onSendToDirector={() => sendToDirector.mutate()}
          isSendingToDirector={sendToDirector.isPending}
          showFinalApproveDialog={showFinalApproveDialog}
          onFinalApproveDialogOpenChange={setShowFinalApproveDialog}
          finalApprovalComments={finalApprovalComments}
          onFinalApprovalCommentsChange={setFinalApprovalComments}
          onFinalApprove={() => finalApprove.mutate()}
          isFinalApproving={finalApprove.isPending}
          showEditConflictDialog={showEditConflictDialog}
          onEditConflictDialogOpenChange={setShowEditConflictDialog}
          editConflict={editConflict}
          latestVersionNumber={latestVersion?.versionNumber}
          onCancelMyEdit={() => {
            setShowEditConflictDialog(false);
            setIsEditMode(false);
          }}
          onForceEdit={() => {
            setShowEditConflictDialog(false);
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <BranchTreeView
          reportId={reportId}
          open={showBranchTree}
          onOpenChange={setShowBranchTree}
          onBranchSelect={(branchId) => {
            setSelectedBranchId(branchId);
            setShowBranchTree(false);
          }}
        />

        <MergeDialog
          reportId={reportId}
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
          defaultSourceBranchId={selectedBranchId || undefined}
          onMergeComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'versions'] });
            setShowMergeDialog(false);
          }}
        />

        {showVersionComparison && comparisonVersions.versionA && comparisonVersions.versionB && (
          <Dialog open={showVersionComparison} onOpenChange={setShowVersionComparison}>
            <DialogContent className="glassmorphic max-w-6xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{t('demand.tabs.requirements.versionComparison')}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[calc(90vh-8rem)]">
                <VersionDiffViewer
                  versionA={comparisonVersions.versionA}
                  versionB={comparisonVersions.versionB}
                  onClose={() => setShowVersionComparison(false)}
                />
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}

        <VersionDetailView
          open={showVersionDetail}
          onClose={() => setShowVersionDetail(false)}
          version={selectedVersionForDetail}
        />

        {showRestoreDialog && (
          <VersionRestoreDialog
            open={showRestoreDialog}
            onClose={() => {
              setShowRestoreDialog(false);
              setSelectedVersionForRestore(null);
              setConflictWarnings([]);
              setIsVersionLockedForRestore(false);
            }}
            version={selectedVersionForRestore}
            currentVersion={latestVersion}
            onConfirmRestore={(versionId) => confirmRestoreVersion.mutate(versionId)}
            isRestoring={confirmRestoreVersion.isPending}
            conflictWarnings={conflictWarnings}
            isLocked={isVersionLockedForRestore}
            lockedBy={selectedVersionForRestore?.createdByName}
          />
        )}
      </Suspense>

    </div>
  );
}
