import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Shield,
  Target,
  Flag as _Flag,
  Layers,
  CheckCircle2,
  TrendingUp,
  CalendarDays as _CalendarDays,
  AlertTriangle,
  Sparkles,
  FileText,
  Clock,
  Send,
  Lock,
  Unlock,
  PenLine,
  Building2 as _Building2,
  User,
  Calendar as _Calendar,
  DollarSign,
  ChevronRight,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import type { ProjectData, BusinessCaseData, DemandReportData, BusinessCaseRisk } from "../../types";

interface ObjectiveItem {
  objective?: string;
  name?: string;
  title?: string;
  description?: string;
}

interface RiskItem {
  risk?: string;
  name?: string;
  description?: string;
  impact?: string;
  severity?: string;
  mitigation?: string;
  mitigationStrategy?: string;
}

interface RawPhaseItem {
  phase?: string;
  name?: string;
  title?: string;
  duration?: string;
  timeframe?: string;
  description?: string | string[];
  activities?: string;
  startDate?: string;
  start?: string;
  endDate?: string;
  end?: string;
  deliverables?: string[];
  outputs?: string[];
  keyDeliverables?: string[];
}

interface CriteriaItem {
  criterion?: string;
  criteria?: string;
  name?: string;
  target?: string;
  targetValue?: string;
}

interface KpiItem {
  name?: string;
  metric?: string;
  kpi?: string;
  baseline?: string;
  current?: string;
  target?: string;
  targetValue?: string;
}

interface DeliverableItem {
  name?: string;
  deliverable?: string;
  title?: string;
  description?: string;
  status?: string;
  phase?: string;
}

interface CharterRiskEdit {
  risk: string;
  impact: string;
  mitigation: string;
}

interface CharterCriteriaEdit {
  criterion: string;
  target: string;
}

interface CharterKpiEdit {
  name: string;
  baseline: string;
  target: string;
}

interface CharterEditsData {
  projectObjective?: string;
  projectScope?: string;
  risks?: CharterRiskEdit[];
  timeline?: TimelinePhase[];
  successCriteria?: CharterCriteriaEdit[];
  kpis?: CharterKpiEdit[];
  financials?: {
    totalCost?: number | string;
    totalBenefit?: number | string;
    roi?: number | string;
    npv?: number | string;
    paybackMonths?: number | string;
  };
}

interface CharterSaveResponse {
  data?: {
    metadata?: {
      charterEdits?: CharterEditsData;
    };
  };
}

interface CharterSignResponse {
  message?: string;
}

interface ScopeObject {
  inScope?: string | string[];
  outOfScope?: string | string[];
}

type CharterSignatureStatus = 'draft' | 'pending_signature' | 'signed' | 'locked';

interface CharterSignature {
  signedByName?: string;
  signedAt?: string;
}

interface CharterSignatures {
  project_manager?: CharterSignature;
  financial_director?: CharterSignature;
  sponsor?: CharterSignature;
}

interface ProjectMetadataWithCharter extends Record<string, unknown> {
  charterEdits?: CharterEditsData;
  charterSignatures?: CharterSignatures;
}

interface ProjectDataWithExtras extends Omit<ProjectData, 'metadata'> {
  charterStatus?: CharterSignatureStatus;
  createdAt?: string | Date;
  financialDirector?: string;
  metadata?: ProjectMetadataWithCharter;
}

interface ProjectCharterViewProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  demandReport?: DemandReportData;
}

type BusinessCaseWithExtras = BusinessCaseData & {
  projectJustification?: string;
  projectObjectives?: string[];
  scope?: string;
  projectScope?: string;
  scopeStatement?: string;
  deliverables?: string[];
  keyDeliverables?: string[];
  implementationTimeline?: string | { phases?: unknown[]; milestones?: unknown[] };
  projectTimeline?: string | { phases?: unknown[]; milestones?: unknown[] };
  timeline?: unknown;
  milestones?: unknown[];
  phases?: unknown[];
  implementationPhases?: unknown[];
  implementationPlan?: { phases?: unknown[]; milestones?: unknown[]; timeline?: unknown };
  keyRisks?: BusinessCaseRisk[];
  performanceIndicators?: unknown[];
  successMetrics?: unknown[];
  budgetEstimates?: { totalCost?: number };
  kpis?: unknown[];
  successCriteria?: unknown[];
  performanceTargets?: unknown[];
  measurementPlan?: unknown;
  totalCostEstimate?: number | string;
  totalBenefitEstimate?: number | string;
  roiPercentage?: number | string;
  npvValue?: number | string;
  paybackMonths?: number | string;
  totalCost?: number | string;
  totalBenefit?: number | string;
  roi?: number | string;
  npv?: number | string;
  paybackPeriod?: number | string;
  financialOverview?: {
    totalCost?: number;
    totalBenefit?: number;
    roi?: number;
    npv?: number;
    paybackPeriod?: number;
  };
};

type DemandReportWithExtras = DemandReportData & {
  businessNeed?: string;
};

// Charter editable data interface
interface TimelinePhase {
  phase: string;
  duration: string;
  description: string;
  startDate?: string;
  endDate?: string;
  deliverables?: string[];
}

interface CharterEditableData {
  projectObjective: string;
  projectScope: string;
  risks: CharterRiskEdit[];
  timeline: TimelinePhase[];
  successCriteria: CharterCriteriaEdit[];
  kpis: CharterKpiEdit[];
  totalCost: string;
  totalBenefit: string;
  roi: string;
  npv: string;
  paybackMonths: string;
}

export function ProjectCharterView({
  project,
  businessCase,
  demandReport,
}: ProjectCharterViewProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Get charter status from project metadata or default to 'draft'
  const projectExt = project as ProjectDataWithExtras;
  const charterStatus = (projectExt.charterStatus || 'draft') as CharterSignatureStatus;
  const isLocked = charterStatus === 'signed' || charterStatus === 'locked';

  // Get project metadata for charter edits
  const projectMetadata = (project.metadata || {}) as { charterEdits?: CharterEditsData };

  const bc = (businessCase?.content || businessCase) as BusinessCaseWithExtras | undefined;
  const dr = (demandReport?.content || demandReport) as DemandReportWithExtras | undefined;
  
  // Initialize editable data - prefer saved edits from metadata, fallback to business case
  const getInitialEditData = (): CharterEditableData => {
    const savedEdits = projectMetadata?.charterEdits || {};
    const savedFinancials = savedEdits.financials || {};
    
    // If we have saved edits, use them
    if (savedEdits.projectObjective !== undefined) {
      return {
        projectObjective: savedEdits.projectObjective || '',
        projectScope: savedEdits.projectScope || '',
        risks: Array.isArray(savedEdits.risks) ? savedEdits.risks as CharterRiskEdit[] : [],
        timeline: Array.isArray(savedEdits.timeline) ? savedEdits.timeline as TimelinePhase[] : [],
        successCriteria: Array.isArray(savedEdits.successCriteria) ? savedEdits.successCriteria as CharterCriteriaEdit[] : [],
        kpis: Array.isArray(savedEdits.kpis) ? savedEdits.kpis as CharterKpiEdit[] : [],
        totalCost: String(savedFinancials.totalCost || ''),
        totalBenefit: String(savedFinancials.totalBenefit || ''),
        roi: String(savedFinancials.roi || ''),
        npv: String(savedFinancials.npv || ''),
        paybackMonths: String(savedFinancials.paybackMonths || ''),
      };
    }
    
    // Fallback to business case data
    const objectives = bc?.projectObjectives || bc?.objectives || [];
    const objectiveText = Array.isArray(objectives) 
      ? objectives.map((o: string | ObjectiveItem) => typeof o === 'string' ? o : o.objective || o.description || '').join('\n')
      : (bc?.projectJustification || dr?.businessNeed || '');
    
    const scopeText = bc?.scope || bc?.projectScope || bc?.scopeStatement || '';
    
    const risksData = bc?.keyRisks || bc?.risks || [];
    const risksList: CharterRiskEdit[] = Array.isArray(risksData) 
      ? risksData.slice(0, 5).map((r: string | RiskItem | BusinessCaseRisk) => ({
          risk: typeof r === 'string' ? r : (r.risk || r.name || r.description || ''),
          impact: typeof r === 'string' ? '' : (r.impact || ('severity' in r ? r.severity : '') || ''),
          mitigation: typeof r === 'string' ? '' : (r.mitigation || ('mitigationStrategy' in r ? r.mitigationStrategy : '') || '')
        }))
      : [];
    
    // Extract timeline phases ONLY - exclude milestones (they are separate deliverables, not phases)
    // Priority: implementationPhases > phases from implementationPlan > timeline.phases
    let rawPhases: RawPhaseItem[] = [];
    if (Array.isArray(bc?.implementationPhases) && bc.implementationPhases.length > 0) {
      rawPhases = bc.implementationPhases as RawPhaseItem[];
    } else if (bc?.implementationPlan?.phases && Array.isArray(bc.implementationPlan.phases)) {
      rawPhases = bc.implementationPlan.phases as RawPhaseItem[];
    } else if (bc?.timeline && typeof bc.timeline === 'object' && !Array.isArray(bc.timeline) && Array.isArray((bc.timeline as { phases?: RawPhaseItem[] }).phases)) {
      rawPhases = (bc.timeline as { phases: RawPhaseItem[] }).phases;
    } else if (Array.isArray(bc?.phases)) {
      rawPhases = bc.phases as RawPhaseItem[];
    }
    // Filter out items that look like milestones (short names without duration/description)
    const filteredPhases = rawPhases.filter((p: RawPhaseItem) => {
      const name = p.phase || p.name || p.title || '';
      // Keep items that have duration OR description OR look like actual phases
      return p.duration || p.timeframe || p.description || p.activities || 
             name.toLowerCase().includes('phase') || name.toLowerCase().includes('stage');
    });
    const timelineList: TimelinePhase[] = filteredPhases.map((t: RawPhaseItem) => ({
      phase: t.phase || t.name || t.title || '',
      duration: t.duration || t.timeframe || '',
      description: Array.isArray(t.description) ? t.description.join(', ') : (t.description || t.activities || ''),
      startDate: t.startDate || t.start || '',
      endDate: t.endDate || t.end || '',
      deliverables: Array.isArray(t.deliverables) ? t.deliverables : 
                   Array.isArray(t.outputs) ? t.outputs :
                   Array.isArray(t.keyDeliverables) ? t.keyDeliverables : []
    }));
    
    // Extract success criteria
    const criteriaData = bc?.successCriteria || [];
    const criteriaList: CharterCriteriaEdit[] = Array.isArray(criteriaData)
      ? (criteriaData as (string | CriteriaItem)[]).map((c: string | CriteriaItem) => ({
          criterion: typeof c === 'string' ? c : (c.criterion || c.criteria || c.name || ''),
          target: typeof c === 'string' ? '' : (c.target || c.targetValue || '')
        }))
      : [];
    
    // Extract KPIs
    const kpisData = bc?.kpis || bc?.performanceTargets || [];
    const kpisList: CharterKpiEdit[] = Array.isArray(kpisData)
      ? (kpisData as KpiItem[]).map((k: KpiItem) => ({
          name: k.name || k.metric || k.kpi || '',
          baseline: k.baseline || k.current || '',
          target: k.target || k.targetValue || ''
        }))
      : [];
    
    return {
      projectObjective: objectiveText,
      projectScope: typeof scopeText === 'string' ? scopeText : JSON.stringify(scopeText),
      risks: risksList,
      timeline: timelineList,
      successCriteria: criteriaList,
      kpis: kpisList,
      totalCost: String(bc?.totalCostEstimate || bc?.totalCost || bc?.financialOverview?.totalCost || project.totalBudget || ''),
      totalBenefit: String(bc?.totalBenefitEstimate || bc?.totalBenefit || bc?.financialOverview?.totalBenefit || ''),
      roi: String(bc?.roiPercentage || bc?.roi || bc?.financialOverview?.roi || ''),
      npv: String(bc?.npvValue || bc?.npv || bc?.financialOverview?.npv || ''),
      paybackMonths: String(bc?.paybackMonths || bc?.paybackPeriod || bc?.financialOverview?.paybackPeriod || ''),
    };
  };
  
  const [editData, setEditData] = useState<CharterEditableData>(getInitialEditData);
  
  // Save charter edits mutation
  const saveCharterMutation = useMutation({
    mutationFn: async (data: CharterEditableData) => {
      const response = await apiRequest('PATCH', `/api/portfolio/projects/${project.id}/charter`, data);
      return response.json();
    },
    onSuccess: (response: CharterSaveResponse) => {
      // Update editData with saved values from response
      const savedProject = response?.data;
      if (savedProject?.metadata?.charterEdits) {
        const ce = savedProject.metadata.charterEdits;
        const fin = ce.financials || {};
        setEditData({
          projectObjective: ce.projectObjective || editData.projectObjective,
          projectScope: ce.projectScope || editData.projectScope,
          risks: Array.isArray(ce.risks) ? ce.risks : editData.risks,
          timeline: Array.isArray(ce.timeline) ? ce.timeline : editData.timeline,
          successCriteria: Array.isArray(ce.successCriteria) ? ce.successCriteria : editData.successCriteria,
          kpis: Array.isArray(ce.kpis) ? ce.kpis : editData.kpis,
          totalCost: String(fin.totalCost || editData.totalCost),
          totalBenefit: String(fin.totalBenefit || editData.totalBenefit),
          roi: String(fin.roi || editData.roi),
          npv: String(fin.npv || editData.npv),
          paybackMonths: String(fin.paybackMonths || editData.paybackMonths),
        });
      }
      // Invalidate to refetch with saved data
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      setIsEditMode(false);
      toast({ 
        title: t('projectWorkspace.toast.charterSaved'), 
        description: t('projectWorkspace.toast.charterSavedDesc') 
      });
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.error'), description: t('projectWorkspace.toast.failedSaveCharterDesc'), variant: 'destructive' });
    },
  });

  // Send for signature mutation
  const sendForSignatureMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/portfolio/projects/${project.id}/charter/send-for-signature`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({ 
        title: t('projectWorkspace.toast.charterSentForSignature'), 
        description: t('projectWorkspace.toast.charterSentForSignatureDesc') 
      });
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.error'), description: t('projectWorkspace.toast.failedSendCharterDesc'), variant: 'destructive' });
    },
  });

  // Sign charter mutation (for PMO Director)
  const signCharterMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/portfolio/projects/${project.id}/charter/sign`, {});
    },
    onSuccess: (data: Response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      data.json().then((result: CharterSignResponse) => {
        toast({ 
          title: t('projectWorkspace.toast.charterApproved'), 
          description: result.message || t('projectWorkspace.toast.charterApprovedDesc') 
        });
      }).catch(() => {
        toast({ 
          title: t('projectWorkspace.toast.charterApproved'), 
          description: t('projectWorkspace.toast.charterApprovedDesc') 
        });
      });
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.error'), description: t('projectWorkspace.toast.failedSignCharterDesc'), variant: 'destructive' });
    },
  });

  // Items to exclude from timeline display (partial matches, case-insensitive)
  const excludedItems = [
    'rta regulatory approval',
    'technology vendor partnership',
    'infrastructure deployment',
    'fleet integration',
    'safety testing validation',
    'commercial pilot launch',
    'regulatory approval obtained',
    'vendor partnership signed',
    'deployment complete',
    'integration complete',
  ];
  
  // Helper to check if an item should be excluded
  const shouldExclude = (name: string) => {
    const lowerName = name.toLowerCase();
    return excludedItems.some(ex => lowerName.includes(ex));
  };

  // Extract milestone/timeline data with all deliverables
  const extractMilestones = (): RawPhaseItem[] | null => {
    // Only collect actual PHASES, not milestones (milestones are deliverables, not timeline items)
    const phases: RawPhaseItem[] = [];
    
    if (bc?.implementationPhases && Array.isArray(bc.implementationPhases) && bc.implementationPhases.length > 0) {
      phases.push(...(bc.implementationPhases as RawPhaseItem[]));
    } else if (bc?.implementationPlan?.phases && Array.isArray(bc.implementationPlan.phases)) {
      phases.push(...(bc.implementationPlan.phases as RawPhaseItem[]));
    } else if (bc?.phases && Array.isArray(bc.phases)) {
      phases.push(...(bc.phases as RawPhaseItem[]));
    }
    // DO NOT include milestones - they are deliverables, not timeline phases
    
    // Deduplicate by name/phase AND filter out items that look like milestone deliverables
    const seen = new Set<string>();
    const uniquePhases = phases.filter(p => {
      const phaseName = p.phase || p.name || p.title || '';
      const key = phaseName.toLowerCase();
      // Skip if already seen
      if (seen.has(key)) return false;
      // Skip if in exclusion list
      if (shouldExclude(phaseName)) return false;
      // Skip items that look like milestone deliverables (no duration/description, short names)
      const hasDuration = p.duration || p.timeframe;
      const hasDescription = p.description || p.activities;
      const looksLikePhase = key.includes('phase') || key.includes('stage') || key.includes('month');
      if (!hasDuration && !hasDescription && !looksLikePhase) return false;
      seen.add(key);
      return true;
    });
    
    return uniquePhases.length > 0 ? uniquePhases : null;
  };
  
  // Extract ALL deliverables from all sources
  const extractAllDeliverables = () => {
    const allDeliverables: { name: string; phase?: string; description?: string; status?: string }[] = [];
    
    // From top-level deliverables
    const topLevel = bc?.deliverables || bc?.keyDeliverables || [];
    if (Array.isArray(topLevel)) {
      topLevel.forEach((del: string | DeliverableItem) => {
        const name = typeof del === 'string' ? del : (del.name || del.deliverable || del.title);
        if (name) {
          allDeliverables.push({ 
            name, 
            phase: typeof del === 'object' ? del.phase : undefined,
            description: typeof del === 'object' ? del.description : undefined,
            status: typeof del === 'object' ? del.status : undefined
          });
        }
      });
    }
    
    // From implementation phases
    const phases = bc?.implementationPhases || bc?.phases || bc?.implementationPlan?.phases || [];
    if (Array.isArray(phases)) {
      (phases as RawPhaseItem[]).forEach((phase: RawPhaseItem) => {
        const phaseName = phase.phase || phase.name || phase.title;
        const phaseDeliverables = phase.deliverables || phase.outputs || phase.keyDeliverables || [];
        if (Array.isArray(phaseDeliverables)) {
          phaseDeliverables.forEach((del: string | DeliverableItem) => {
            const name = typeof del === 'string' ? del : (del.name || del.deliverable || del.title);
            if (name) {
              allDeliverables.push({ 
                name, 
                phase: phaseName,
                description: typeof del === 'object' ? del.description : undefined,
                status: typeof del === 'object' ? del.status : undefined
              });
            }
          });
        }
      });
    }
    
    // From milestones
    interface MilestoneItem {
      name?: string;
      milestone?: string;
      deliverables?: (string | DeliverableItem)[];
      outputs?: (string | DeliverableItem)[];
    }
    const milestones = bc?.milestones || bc?.implementationPlan?.milestones || [];
    if (Array.isArray(milestones)) {
      (milestones as MilestoneItem[]).forEach((m: MilestoneItem) => {
        const mDeliverables = m.deliverables || m.outputs || [];
        if (Array.isArray(mDeliverables)) {
          mDeliverables.forEach((del: string | DeliverableItem) => {
            const name = typeof del === 'string' ? del : (del.name || del.deliverable);
            if (name) {
              allDeliverables.push({ 
                name, 
                phase: m.name || m.milestone,
                description: typeof del === 'object' ? del.description : undefined
              });
            }
          });
        }
      });
    }
    
    // Deduplicate and filter out excluded items
    const seen = new Set<string>();
    return allDeliverables.filter(d => {
      const key = d.name.toLowerCase();
      // Skip excluded items
      if (shouldExclude(d.name)) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Extract financial data
  const extractFinancialData = () => {
    const totalCost = bc?.totalCostEstimate || bc?.totalCost || bc?.financialOverview?.totalCost || project.totalBudget;
    const totalBenefit = bc?.totalBenefitEstimate || bc?.totalBenefit || bc?.financialOverview?.totalBenefit;
    const roi = bc?.roiPercentage || bc?.roi || bc?.financialOverview?.roi;
    const npv = bc?.npvValue || bc?.npv || bc?.financialOverview?.npv;
    const payback = bc?.paybackMonths || bc?.paybackPeriod || bc?.financialOverview?.paybackPeriod;
    
    if (!totalCost && !totalBenefit && !roi && !npv && !payback) {
      return null;
    }
    
    return { totalCost, totalBenefit, roi, npv, payback };
  };

  const milestoneData = extractMilestones();
  const financialData = extractFinancialData();
  const allDeliverables = extractAllDeliverables();

  // Extract critical milestones with dates from BC
  const criticalMilestones: Array<{ name: string; date?: string }> = (() => {
    const raw = bc?.milestones ||
      (bc?.timeline && typeof bc.timeline === 'object' && !Array.isArray(bc.timeline)
        ? (bc.timeline as { milestones?: unknown[] }).milestones
        : undefined) ||
      bc?.implementationPlan?.milestones ||
      [];
    if (!Array.isArray(raw)) return [];
    return raw
      .map((milestone) => {
        const m = (typeof milestone === 'object' && milestone) ? milestone as Record<string, unknown> : {};
        return {
          name: String(m.name || m.milestone || m.title || ''),
          date: m.date ? String(m.date) : m.targetDate ? String(m.targetDate) : undefined,
        };
      })
      .filter(m => m.name);
  })();

  const formatCurrency = (amount?: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (!num) return 'TBD';
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (date?: string | Date) => {
    if (!date) return 'TBD';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  // Get charter edits from metadata if available
  const charterEdits: CharterEditsData = projectMetadata?.charterEdits || {};
  const editedFinancials = charterEdits.financials || {};

  // Extract key data - prefer edited data from metadata, fallback to business case/demand report
  const projectPurpose = bc?.executiveSummary || bc?.projectJustification || dr?.businessNeed || dr?.problemStatement || project.description || 'Not defined';
  
  // Parse objectives from edited string if available
  const objectivesFromEdit = charterEdits.projectObjective 
    ? charterEdits.projectObjective.split('\n').filter((s: string) => s.trim())
    : null;
  const objectives = objectivesFromEdit || bc?.smartObjectives || bc?.objectives || bc?.projectObjectives || [];
  
  // Use edited scope if available
  const scope = charterEdits.projectScope || bc?.scopeDefinition || bc?.scope || bc?.projectScope;
  
  // Use edited risks if available - handle both string and object formats
  const editedRisks = charterEdits.risks && Array.isArray(charterEdits.risks) && charterEdits.risks.length > 0
    ? charterEdits.risks.filter((r: RiskItem | string) => {
        if (typeof r === 'string') return r.trim();
        if (typeof r === 'object' && r !== null) return r.risk || r.name || r.description;
        return false;
      })
    : null;
  const risks = editedRisks || bc?.identifiedRisks || bc?.risks || bc?.keyRisks || [];
  
  // Use edited timeline if available
  const editedTimeline = charterEdits.timeline && Array.isArray(charterEdits.timeline) && charterEdits.timeline.length > 0
    ? charterEdits.timeline
    : null;
  
  // Use edited success criteria if available  
  const editedSuccessCriteria = charterEdits.successCriteria && Array.isArray(charterEdits.successCriteria) && charterEdits.successCriteria.length > 0
    ? charterEdits.successCriteria
    : null;
  const successCriteria = editedSuccessCriteria || bc?.successCriteria || [];
  
  // Use edited KPIs if available
  const editedKpis = charterEdits.kpis && Array.isArray(charterEdits.kpis) && charterEdits.kpis.length > 0
    ? charterEdits.kpis
    : null;
  const kpis = editedKpis || bc?.kpis || bc?.performanceTargets || [];
  
  // Override milestone data with edited timeline if present
  const displayMilestoneData = editedTimeline || milestoneData;
  
  // Override financial data with edited values if present
  const displayFinancialData = financialData ? {
    ...financialData,
    totalCost: editedFinancials.totalCost ?? financialData.totalCost,
    totalBenefit: editedFinancials.totalBenefit ?? financialData.totalBenefit,
    roi: editedFinancials.roi ?? financialData.roi,
    npv: editedFinancials.npv ?? financialData.npv,
    payback: editedFinancials.paybackMonths ?? financialData.payback,
  } : (editedFinancials.totalCost ? {
    totalCost: editedFinancials.totalCost,
    totalBenefit: editedFinancials.totalBenefit,
    roi: editedFinancials.roi,
    npv: editedFinancials.npv,
    payback: editedFinancials.paybackMonths,
  } : null);

  const _getStatusBadge = () => {
    switch (charterStatus) {
      case 'signed':
      case 'locked':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1.5">
            <Lock className="w-3 h-3" />
            Signed & Locked
          </Badge>
        );
      case 'pending_signature':
        return (
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1.5">
            <Clock className="w-3 h-3" />
            Pending Signature
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-500/30 gap-1.5">
            <Unlock className="w-3 h-3" />
            Draft
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Locked Notice */}
      {isLocked && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Charter approved and locked for reference.</p>
        </div>
      )}
      
      {/* Pending Signature Notice */}
      {charterStatus === 'pending_signature' && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-400">Awaiting signature approval from Project Manager, Financial Director, and Executive Sponsor.</p>
        </div>
      )}

      {/* Premium Government Document Layout */}
      <div className="relative border border-border/40 rounded-lg overflow-hidden bg-gradient-to-b from-background via-background to-muted/10 shadow-sm">
        {/* Decorative Corner Accents */}
        <div className="absolute top-0 left-0 w-16 h-16 border-l-2 border-t-2 border-primary/20 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-16 h-16 border-r-2 border-t-2 border-primary/20 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-16 h-16 border-l-2 border-b-2 border-primary/20 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-16 h-16 border-r-2 border-b-2 border-primary/20 rounded-br-lg" />

        {/* Document Header */}
        <div className="relative px-8 pt-8 pb-6 border-b border-border/30">
          <div className="flex items-start justify-between gap-6">
            {/* Left Side - Title and Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-4 h-4 text-primary/60" />
                <p className="text-[10px] uppercase tracking-[0.2em] font-medium">
                  Government of the United Arab Emirates
                </p>
              </div>
              <h1 className="text-lg font-semibold tracking-wide text-foreground">
                Project Charter
              </h1>
              <h2 className="text-base text-foreground/80">{project.projectName}</h2>
              <div className="flex items-center gap-1 pt-1">
                <div className="w-8 h-0.5 bg-primary/40 rounded-full" />
                <div className="w-2 h-0.5 bg-primary/20 rounded-full" />
              </div>
            </div>

            {/* Right Side - Document Meta */}
            <div className="text-right space-y-1 pt-1">
              <div className="flex items-center justify-end gap-2">
                <span className="text-[10px] text-muted-foreground uppercase">Ref:</span>
                <span className="text-xs font-medium text-foreground/80">{project.projectCode}</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-[10px] text-muted-foreground uppercase">Version:</span>
                <span className="text-xs font-medium text-foreground/80">1.0</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-[10px] text-muted-foreground uppercase">Status:</span>
                <span className="text-xs font-medium text-foreground/80 capitalize">{charterStatus.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-[10px] text-muted-foreground uppercase">Date:</span>
                <span className="text-xs font-medium text-foreground/80">{formatDate(projectExt.createdAt || new Date())}</span>
              </div>
            </div>
          </div>
        </div>

          {/* Document Body */}
          <div className="px-8 py-6 space-y-6">
            {/* Section 1: Executive Summary / Purpose */}
            <section className="space-y-3">
              <div className="flex items-center gap-3 border-b border-border/30 pb-2">
                <span className="text-xs font-medium text-primary/70 uppercase tracking-wider">Section 1</span>
                <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
              </div>
              <h3 className="text-sm font-medium uppercase tracking-wide text-foreground">Project Purpose & Justification</h3>
              <p className="text-sm leading-relaxed text-foreground/80">
                {typeof projectPurpose === 'string' ? projectPurpose : JSON.stringify(projectPurpose)}
              </p>
            </section>

            {/* Section 2: Objectives */}
            <section className="space-y-3">
              <div className="flex items-center gap-3 border-b border-border/30 pb-2">
                <span className="text-xs font-medium text-primary/70 uppercase tracking-wider">Section 2</span>
                <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
                {isEditMode && <Badge variant="outline" className="text-[10px] h-5">Editing</Badge>}
              </div>
              <h3 className="text-sm font-medium uppercase tracking-wide text-foreground">Project Objectives</h3>
              {isEditMode ? (
                <Textarea
                  value={editData.projectObjective}
                  onChange={(e) => setEditData({...editData, projectObjective: e.target.value})}
                  placeholder={t('projectWorkspace.charter.objectivesPlaceholder')}
                  className="min-h-[100px] text-sm"
                  data-testid="textarea-objectives"
                />
              ) : (
                Array.isArray(objectives) && objectives.length > 0 ? (
                  <ul className="space-y-2">
                    {objectives.map((obj: string | ObjectiveItem, i: number) => {
                      const text = typeof obj === 'string' ? obj : (obj.objective || obj.name || obj.title || JSON.stringify(obj));
                      return (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                          <span className="text-primary/60 mt-0.5">•</span>
                          <span className="leading-relaxed">{text}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Objectives to be defined</p>
                )
              )}
            </section>

            {/* Section 3: Scope */}
            <section className="space-y-3">
              <div className="flex items-center gap-3 border-b border-border/30 pb-2">
                <span className="text-xs font-medium text-primary/70 uppercase tracking-wider">Section 3</span>
                <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
                {isEditMode && <Badge variant="outline" className="text-[10px] h-5">Editing</Badge>}
              </div>
              <h3 className="text-sm font-medium uppercase tracking-wide text-foreground">Project Scope</h3>
              {isEditMode ? (
                <Textarea
                  value={editData.projectScope}
                  onChange={(e) => setEditData({...editData, projectScope: e.target.value})}
                  placeholder={t('projectWorkspace.charter.scopePlaceholder')}
                  className="min-h-[100px] text-sm"
                  data-testid="textarea-scope"
                />
              ) : (
                scope ? (
                  typeof scope === 'object' ? (
                    <div className="space-y-3">
                      {(() => {
                        const scopeObj = scope as ScopeObject;
                        return (
                          <>
                            {scopeObj.inScope && (
                              <div>
                                <h4 className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">In Scope</h4>
                                <p className="text-sm leading-relaxed text-foreground/80">
                                  {Array.isArray(scopeObj.inScope) ? scopeObj.inScope.join(', ') : scopeObj.inScope}
                                </p>
                              </div>
                            )}
                            {scopeObj.outOfScope && (
                              <div>
                                <h4 className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Out of Scope</h4>
                                <p className="text-sm leading-relaxed text-foreground/80">
                                  {Array.isArray(scopeObj.outOfScope) ? scopeObj.outOfScope.join(', ') : scopeObj.outOfScope}
                                </p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed text-foreground/80">{scope}</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground italic">Scope to be defined</p>
                )
              )}
            </section>

            {/* Section 4: Financial Summary */}
            <section className="space-y-3">
              <div className="flex items-center gap-3 border-b border-border/30 pb-2">
                <span className="text-xs font-medium text-primary/70 uppercase tracking-wider">Section 4</span>
                <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
                {isEditMode && <Badge variant="outline" className="text-[10px] h-5">Editing</Badge>}
              </div>
              <h3 className="text-sm font-medium uppercase tracking-wide text-foreground">Financial Summary</h3>
              <div>
                {isEditMode ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <DollarSign className="w-5 h-5 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                      <div className="text-xs text-muted-foreground uppercase mb-1 text-center">Total Cost (AED)</div>
                      <Input
                        type="number"
                        value={editData.totalCost}
                        onChange={(e) => setEditData({...editData, totalCost: e.target.value})}
                        className="text-center"
                        data-testid="input-total-cost"
                      />
                    </div>
                    <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <TrendingUp className="w-5 h-5 mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                      <div className="text-xs text-muted-foreground uppercase mb-1 text-center">Total Benefit (AED)</div>
                      <Input
                        type="number"
                        value={editData.totalBenefit}
                        onChange={(e) => setEditData({...editData, totalBenefit: e.target.value})}
                        className="text-center"
                        data-testid="input-total-benefit"
                      />
                    </div>
                    <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <Sparkles className="w-5 h-5 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                      <div className="text-xs text-muted-foreground uppercase mb-1 text-center">ROI (%)</div>
                      <Input
                        type="number"
                        value={editData.roi}
                        onChange={(e) => setEditData({...editData, roi: e.target.value})}
                        className="text-center"
                        data-testid="input-roi"
                      />
                    </div>
                    <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <Target className="w-5 h-5 mx-auto mb-2 text-amber-600 dark:text-amber-400" />
                      <div className="text-xs text-muted-foreground uppercase mb-1 text-center">NPV (AED)</div>
                      <Input
                        type="number"
                        value={editData.npv}
                        onChange={(e) => setEditData({...editData, npv: e.target.value})}
                        className="text-center"
                        data-testid="input-npv"
                      />
                    </div>
                    <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <Clock className="w-5 h-5 mx-auto mb-2 text-cyan-600 dark:text-cyan-400" />
                      <div className="text-xs text-muted-foreground uppercase mb-1 text-center">Payback (Months)</div>
                      <Input
                        type="number"
                        value={editData.paybackMonths}
                        onChange={(e) => setEditData({...editData, paybackMonths: e.target.value})}
                        className="text-center"
                        data-testid="input-payback"
                      />
                    </div>
                  </div>
                ) : (
                  displayFinancialData ? (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 text-center border border-slate-200 dark:border-slate-700">
                        <DollarSign className="w-5 h-5 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                        <div className="text-xs text-muted-foreground uppercase mb-1">Total Cost</div>
                        <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(displayFinancialData.totalCost)}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 text-center border border-slate-200 dark:border-slate-700">
                        <TrendingUp className="w-5 h-5 mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                        <div className="text-xs text-muted-foreground uppercase mb-1">Total Benefit</div>
                        <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(displayFinancialData.totalBenefit)}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 text-center border border-slate-200 dark:border-slate-700">
                        <Sparkles className="w-5 h-5 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                        <div className="text-xs text-muted-foreground uppercase mb-1">ROI</div>
                        <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
                          {displayFinancialData.roi ? `${typeof displayFinancialData.roi === 'string' ? parseFloat(displayFinancialData.roi).toFixed(1) : (displayFinancialData.roi as number).toFixed(1)}%` : 'TBD'}
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 text-center border border-slate-200 dark:border-slate-700">
                        <Target className="w-5 h-5 mx-auto mb-2 text-amber-600 dark:text-amber-400" />
                        <div className="text-xs text-muted-foreground uppercase mb-1">NPV</div>
                        <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(displayFinancialData.npv)}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 text-center border border-slate-200 dark:border-slate-700">
                        <Clock className="w-5 h-5 mx-auto mb-2 text-cyan-600 dark:text-cyan-400" />
                        <div className="text-xs text-muted-foreground uppercase mb-1">Payback</div>
                        <div className="text-lg font-bold text-cyan-700 dark:text-cyan-300">
                          {displayFinancialData.payback ? `${typeof displayFinancialData.payback === 'string' ? parseFloat(displayFinancialData.payback).toFixed(0) : (displayFinancialData.payback as number).toFixed(0)} months` : 'TBD'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">Financial analysis pending</p>
                  )
                )}
              </div>
            </section>

            {/* Section 5: Timeline / Milestones */}
            <section className="space-y-3">
              <div className="flex items-center gap-3 border-b border-border/30 pb-2">
                <span className="text-xs font-medium text-primary/70 uppercase tracking-wider">Section 5</span>
                <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
                {isEditMode && <Badge variant="outline" className="text-[10px] h-5">Editing</Badge>}
                {!isEditMode && displayMilestoneData && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    {displayMilestoneData.length} Phase{displayMilestoneData.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <h3 className="text-sm font-medium uppercase tracking-wide text-foreground">Implementation Timeline</h3>
              <div>
                {isEditMode ? (
                  <div className="space-y-4">
                    {editData.timeline.map((phase: TimelinePhase, i: number) => (
                      <div key={i} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </div>
                          <Input
                            value={phase.phase}
                            onChange={(e) => {
                              const newTimeline = [...editData.timeline];
                              newTimeline[i] = {...newTimeline[i]!, phase: e.target.value};
                              setEditData({...editData, timeline: newTimeline});
                            }}
                            placeholder={t('projectWorkspace.charter.phaseName')}
                            className="flex-1"
                            data-testid={`input-timeline-phase-${i}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const newTimeline = editData.timeline.filter((_: TimelinePhase, idx: number) => idx !== i);
                              setEditData({...editData, timeline: newTimeline});
                            }}
                            data-testid={`button-remove-timeline-${i}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Duration</label>
                            <Input
                              value={phase.duration}
                              onChange={(e) => {
                                const newTimeline = [...editData.timeline];
                                newTimeline[i] = {...newTimeline[i]!, duration: e.target.value};
                                setEditData({...editData, timeline: newTimeline});
                              }}
                              placeholder="e.g., 3 months"
                              data-testid={`input-timeline-duration-${i}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                            <Input
                              value={phase.description}
                              onChange={(e) => {
                                const newTimeline = [...editData.timeline];
                                newTimeline[i] = {...newTimeline[i]!, description: e.target.value};
                                setEditData({...editData, timeline: newTimeline});
                              }}
                              placeholder={t('projectWorkspace.charter.phaseDescription')}
                              data-testid={`input-timeline-desc-${i}`}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
                            <Input
                              type="date"
                              value={phase.startDate || ''}
                              onChange={(e) => {
                                const newTimeline = [...editData.timeline];
                                newTimeline[i] = {...newTimeline[i]!, startDate: e.target.value};
                                setEditData({...editData, timeline: newTimeline});
                              }}
                              data-testid={`input-timeline-start-${i}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
                            <Input
                              type="date"
                              value={phase.endDate || ''}
                              onChange={(e) => {
                                const newTimeline = [...editData.timeline];
                                newTimeline[i] = {...newTimeline[i]!, endDate: e.target.value};
                                setEditData({...editData, timeline: newTimeline});
                              }}
                              data-testid={`input-timeline-end-${i}`}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-2 block">Key Deliverables</label>
                          <div className="space-y-2">
                            {(Array.isArray(phase.deliverables) ? phase.deliverables : []).map((deliverable: string, dIdx: number) => (
                              <div key={dIdx} className="flex items-center gap-2">
                                <Input
                                  value={typeof deliverable === 'string' ? deliverable : ''}
                                  onChange={(e) => {
                                    const newTimeline = [...editData.timeline];
                                    const newDeliverables = [...(newTimeline[i]!.deliverables || [])];
                                    newDeliverables[dIdx] = e.target.value;
                                    newTimeline[i] = {...newTimeline[i]!, deliverables: newDeliverables};
                                    setEditData({...editData, timeline: newTimeline});
                                  }}
                                  placeholder={t('projectWorkspace.charter.deliverableName')}
                                  className="flex-1"
                                  data-testid={`input-deliverable-${i}-${dIdx}`}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    const newTimeline = [...editData.timeline];
                                    const newDeliverables = (newTimeline[i]!.deliverables || []).filter((_: string, idx: number) => idx !== dIdx);
                                    newTimeline[i] = {...newTimeline[i]!, deliverables: newDeliverables};
                                    setEditData({...editData, timeline: newTimeline});
                                  }}
                                  data-testid={`button-remove-deliverable-${i}-${dIdx}`}
                                >
                                  <Trash2 className="w-3 h-3 text-red-500" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newTimeline = [...editData.timeline];
                                const newDeliverables = [...(newTimeline[i]!.deliverables || []), ''];
                                newTimeline[i] = {...newTimeline[i]!, deliverables: newDeliverables};
                                setEditData({...editData, timeline: newTimeline});
                              }}
                              className="text-xs gap-1 h-7"
                              data-testid={`button-add-deliverable-${i}`}
                            >
                              <Plus className="w-3 h-3" />
                              Add Deliverable
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditData({...editData, timeline: [...editData.timeline, {phase: '', duration: '', description: '', startDate: '', endDate: '', deliverables: []} as TimelinePhase]})}
                      className="gap-2"
                      data-testid="button-add-timeline"
                    >
                      <Plus className="w-4 h-4" />
                      Add Phase
                    </Button>
                  </div>
                ) : (
                  Array.isArray(displayMilestoneData) && displayMilestoneData.length > 0 ? (
                    <div className="relative">
                      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500 via-blue-500 to-purple-500" />
                      <div className="space-y-6">
                        {displayMilestoneData.map((item: TimelinePhase | RawPhaseItem, i: number) => {
                          const name = item.phase || ('name' in item ? item.name : '') || ('title' in item ? item.title : '') || `Phase ${i + 1}`;
                          const duration = item.duration || ('timeframe' in item ? item.timeframe : '') || '';
                          const description = item.description || ('activities' in item ? item.activities : '') || '';
                          const startDate = item.startDate || ('start' in item ? item.start : undefined);
                          const endDate = item.endDate || ('end' in item ? item.end : undefined);
                          
                          return (
                            <div key={i} className="relative pl-8">
                              <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-lg">
                                {i + 1}
                              </div>
                              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <h4 className="font-bold text-base">{name}</h4>
                                  <div className="flex items-center gap-2">
                                    {duration && <Badge variant="outline" className="text-xs bg-cyan-500/10 border-cyan-500/30">{duration}</Badge>}
                                    {(startDate || endDate) && (
                                      <Badge variant="outline" className="text-xs bg-blue-500/10 border-blue-500/30">
                                        {startDate && formatDate(startDate)} {startDate && endDate && '→'} {endDate && formatDate(endDate)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {description && (
                                  <p className="text-sm text-muted-foreground mb-3">
                                    {Array.isArray(description) ? description.join(', ') : description}
                                  </p>
                                )}
                                
                                {/* Phase Deliverables */}
                                {(() => {
                                  const rawItem = item as RawPhaseItem;
                                  const phaseDeliverables = item.deliverables || rawItem.outputs || rawItem.keyDeliverables || [];
                                  const relatedDeliverables = allDeliverables.filter(d => 
                                    d.phase?.toLowerCase() === name.toLowerCase()
                                  );
                                  const displayDeliverables = phaseDeliverables.length > 0 ? phaseDeliverables : relatedDeliverables;
                                  
                                  const filteredDeliverables = displayDeliverables.filter((del: string | DeliverableItem | { name: string; phase?: string; description?: string; status?: string }) => {
                                    const delName = typeof del === 'string' ? del : (del.name || ('deliverable' in del ? del.deliverable : '') || ('title' in del ? del.title : '') || '');
                                    return !shouldExclude(delName);
                                  });
                                  
                                  return filteredDeliverables.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Layers className="w-3.5 h-3.5 text-purple-500" />
                                        <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                                          Deliverables ({filteredDeliverables.length})
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {filteredDeliverables.map((del: string | DeliverableItem | { name: string; phase?: string; description?: string; status?: string }, j: number) => {
                                          const delName = typeof del === 'string' ? del : (del.name || ('deliverable' in del ? del.deliverable : '') || ('title' in del ? del.title : ''));
                                          const delDesc = typeof del === 'object' ? del.description : undefined;
                                          return (
                                            <div key={j} className="flex items-start gap-2 p-2 rounded bg-purple-500/5 border border-purple-500/15">
                                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                                              <div className="flex-1 min-w-0">
                                                <span className="text-xs font-medium block">{delName}</span>
                                                {delDesc && <span className="text-xs text-muted-foreground line-clamp-1">{delDesc}</span>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">Timeline to be defined</p>
                  )
                )}
              </div>

              {/* Critical Milestones Sub-section */}
              {!isEditMode && criticalMilestones.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <_Flag className="w-4 h-4 text-amber-500" />
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground">Critical Milestones</h4>
                    <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
                      {criticalMilestones.length} Milestone{criticalMilestones.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="relative">
                    <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-400 via-orange-500 to-red-500" />
                    <div className="space-y-4">
                      {criticalMilestones.map((ms, i) => (
                        <div key={i} className="relative pl-8">
                          <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md">
                            M{i + 1}
                          </div>
                          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                            <div className="flex items-center gap-2 min-w-0">
                              <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              <span className="text-sm font-medium">{ms.name}</span>
                            </div>
                            {ms.date && (
                              <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30 whitespace-nowrap">
                                <_CalendarDays className="w-3 h-3 mr-1" />
                                {formatDate(ms.date)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Section 6: Risks */}
            <section className="space-y-3">
              <div className="flex items-center gap-3 border-b border-border/30 pb-2">
                <span className="text-xs font-medium text-primary/70 uppercase tracking-wider">Section 6</span>
                <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
                {isEditMode && <Badge variant="outline" className="text-[10px] h-5">Editing</Badge>}
              </div>
              <h3 className="text-sm font-medium uppercase tracking-wide text-foreground">Key Risks</h3>
              <div>
                {isEditMode ? (
                  <div className="space-y-4">
                    {editData.risks.map((risk, i) => (
                      <div key={i} className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                          <Input
                            value={risk.risk}
                            onChange={(e) => {
                              const newRisks = [...editData.risks];
                              newRisks[i] = {...newRisks[i]!, risk: e.target.value};
                              setEditData({...editData, risks: newRisks});
                            }}
                            placeholder={t('projectWorkspace.charter.riskDescription')}
                            className="flex-1"
                            data-testid={`input-risk-${i}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const newRisks = editData.risks.filter((_, idx) => idx !== i);
                              setEditData({...editData, risks: newRisks});
                            }}
                            data-testid={`button-remove-risk-${i}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-red-600 dark:text-red-400 font-medium mb-1 block">Impact</label>
                            <Input
                              value={risk.impact}
                              onChange={(e) => {
                                const newRisks = [...editData.risks];
                                newRisks[i] = {...newRisks[i]!, impact: e.target.value};
                                setEditData({...editData, risks: newRisks});
                              }}
                              placeholder="e.g., High, Medium, Low"
                              data-testid={`input-risk-impact-${i}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1 block">Mitigation</label>
                            <Input
                              value={risk.mitigation}
                              onChange={(e) => {
                                const newRisks = [...editData.risks];
                                newRisks[i] = {...newRisks[i]!, mitigation: e.target.value};
                                setEditData({...editData, risks: newRisks});
                              }}
                              placeholder={t('projectWorkspace.charter.mitigationStrategy')}
                              data-testid={`input-risk-mitigation-${i}`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditData({...editData, risks: [...editData.risks, {risk: '', impact: '', mitigation: ''}]})}
                      className="gap-2"
                      data-testid="button-add-risk"
                    >
                      <Plus className="w-4 h-4" />
                      Add Risk
                    </Button>
                  </div>
                ) : (
                  Array.isArray(risks) && risks.length > 0 ? (
                    <div className="space-y-3">
                      {risks.slice(0, 5).map((risk: string | RiskItem, i: number) => {
                        const riskText = typeof risk === 'string' ? risk : (risk.risk || risk.name || risk.description || JSON.stringify(risk));
                        const impact = typeof risk === 'string' ? undefined : (risk.impact || risk.severity);
                        const mitigation = typeof risk === 'string' ? undefined : (risk.mitigation || risk.mitigationStrategy);
                        
                        return (
                          <div key={i} className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-medium">{riskText}</p>
                                {(impact || mitigation) && (
                                  <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                                    {impact && (
                                      <div>
                                        <span className="text-red-600 dark:text-red-400 font-medium">Impact: </span>
                                        <span className="text-muted-foreground">{impact}</span>
                                      </div>
                                    )}
                                    {mitigation && (
                                      <div>
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Mitigation: </span>
                                        <span className="text-muted-foreground">{mitigation}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">Risk assessment pending</p>
                  )
                )}
              </div>
            </section>

            {/* Section 7: Success Criteria */}
            <section className="space-y-3">
              <div className="flex items-center gap-3 border-b border-border/30 pb-2">
                <span className="text-xs font-medium text-primary/70 uppercase tracking-wider">Section 7</span>
                <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
                {isEditMode && <Badge variant="outline" className="text-[10px] h-5">Editing</Badge>}
              </div>
              <h3 className="text-sm font-medium uppercase tracking-wide text-foreground">Success Criteria & KPIs</h3>
              <div>
                {isEditMode ? (
                  <div className="space-y-6">
                    {/* Success Criteria Edit */}
                    <div>
                      <h4 className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-3">Success Criteria</h4>
                      <div className="space-y-3">
                        {editData.successCriteria.map((crit, i) => (
                          <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                            <Sparkles className="w-4 h-4 text-violet-500 flex-shrink-0" />
                            <Input
                              value={crit.criterion}
                              onChange={(e) => {
                                const newCriteria = [...editData.successCriteria];
                                newCriteria[i] = {...newCriteria[i]!, criterion: e.target.value};
                                setEditData({...editData, successCriteria: newCriteria});
                              }}
                              placeholder={t('projectWorkspace.charter.successCriterion')}
                              className="flex-1"
                              data-testid={`input-criterion-${i}`}
                            />
                            <Input
                              value={crit.target}
                              onChange={(e) => {
                                const newCriteria = [...editData.successCriteria];
                                newCriteria[i] = {...newCriteria[i]!, target: e.target.value};
                                setEditData({...editData, successCriteria: newCriteria});
                              }}
                              placeholder={t('projectWorkspace.charter.target')}
                              className="w-32"
                              data-testid={`input-criterion-target-${i}`}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const newCriteria = editData.successCriteria.filter((_, idx) => idx !== i);
                                setEditData({...editData, successCriteria: newCriteria});
                              }}
                              data-testid={`button-remove-criterion-${i}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditData({...editData, successCriteria: [...editData.successCriteria, {criterion: '', target: ''}]})}
                          className="gap-2"
                          data-testid="button-add-criterion"
                        >
                          <Plus className="w-4 h-4" />
                          Add Criterion
                        </Button>
                      </div>
                    </div>
                    
                    {/* KPIs Edit */}
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-3">Key Performance Indicators</h4>
                      <div className="space-y-3">
                        {editData.kpis.map((kpi, i) => (
                          <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                              <Input
                                value={kpi.name}
                                onChange={(e) => {
                                  const newKpis = [...editData.kpis];
                                  newKpis[i] = {...newKpis[i]!, name: e.target.value};
                                  setEditData({...editData, kpis: newKpis});
                                }}
                                placeholder={t('projectWorkspace.charter.kpiName')}
                                className="flex-1"
                                data-testid={`input-kpi-name-${i}`}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  const newKpis = editData.kpis.filter((_, idx) => idx !== i);
                                  setEditData({...editData, kpis: newKpis});
                                }}
                                data-testid={`button-remove-kpi-${i}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Baseline</label>
                                <Input
                                  value={kpi.baseline}
                                  onChange={(e) => {
                                    const newKpis = [...editData.kpis];
                                    newKpis[i] = {...newKpis[i]!, baseline: e.target.value};
                                    setEditData({...editData, kpis: newKpis});
                                  }}
                                  placeholder={t('projectWorkspace.charter.currentValue')}
                                  data-testid={`input-kpi-baseline-${i}`}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-emerald-600 dark:text-emerald-400 mb-1 block">Target</label>
                                <Input
                                  value={kpi.target}
                                  onChange={(e) => {
                                    const newKpis = [...editData.kpis];
                                    newKpis[i] = {...newKpis[i]!, target: e.target.value};
                                    setEditData({...editData, kpis: newKpis});
                                  }}
                                  placeholder={t('projectWorkspace.charter.targetValue')}
                                  data-testid={`input-kpi-target-${i}`}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditData({...editData, kpis: [...editData.kpis, {name: '', baseline: '', target: ''}]})}
                          className="gap-2"
                          data-testid="button-add-kpi"
                        >
                          <Plus className="w-4 h-4" />
                          Add KPI
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  (Array.isArray(successCriteria) && successCriteria.length > 0) || (Array.isArray(kpis) && kpis.length > 0) ? (
                    <div className="space-y-4">
                      {Array.isArray(successCriteria) && successCriteria.length > 0 && (
                        <div className="space-y-2">
                          {(successCriteria as (string | CriteriaItem)[]).map((crit: string | CriteriaItem, i: number) => {
                            const text = typeof crit === 'string' ? crit : (crit.criterion || crit.criteria || crit.name);
                            const target = typeof crit === 'string' ? undefined : (crit.target || crit.targetValue);
                            return (
                              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                                <Sparkles className="w-4 h-4 text-violet-500 flex-shrink-0" />
                                <span className="text-sm">{text}</span>
                                {target && <Badge variant="outline" className="ml-auto text-xs">Target: {target}</Badge>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {Array.isArray(kpis) && kpis.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                          {(kpis as KpiItem[]).slice(0, 6).map((kpi: KpiItem, i: number) => {
                            const name = kpi.name || kpi.metric || kpi.kpi || `KPI ${i + 1}`;
                            const baseline = kpi.baseline || kpi.current;
                            const target = kpi.target || kpi.targetValue;
                            return (
                              <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
                                <div className="font-medium text-sm mb-2">{name}</div>
                                <div className="flex gap-4 text-xs">
                                  <div><span className="text-muted-foreground">Baseline:</span> <span className="font-medium">{baseline || 'TBD'}</span></div>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                  <div><span className="text-emerald-600 dark:text-emerald-400">Target:</span> <span className="font-medium">{target || 'TBD'}</span></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">Success criteria to be defined</p>
                  )
                )}
              </div>
            </section>
          </div>

          {/* Signature Section - Project Manager & Executive Sponsor Approval Required */}
          <div className="border-t border-border/30 bg-muted/10 px-8 py-6">
            <div className="flex items-center gap-3 border-b border-border/30 pb-2 mb-4">
              <span className="text-xs font-medium text-primary/70 uppercase tracking-wider">Approval</span>
              <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
              {charterStatus === 'pending_signature' && (
                <Badge variant="outline" className="text-[10px] h-5 border-amber-500/30 text-amber-600">Awaiting Signatures</Badge>
              )}
              {isLocked && (
                <Badge variant="outline" className="text-[10px] h-5 border-emerald-500/30 text-emerald-600">Approved</Badge>
              )}
            </div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-foreground mb-4">Charter Approval</h3>
            
            <p className="text-center text-xs text-muted-foreground mb-4">
              Signatures from Project Manager, Financial Director, and Executive Sponsor required for approval.
            </p>
            
            {/* Signature Cards Grid */}
            {(() => {
              const projectMetadataExt = projectExt.metadata || {};
              const signatures: CharterSignatures = projectMetadataExt.charterSignatures || {};
              const pmSig = signatures.project_manager;
              const financeSig = signatures.financial_director;
              const sponsorSig = signatures.sponsor;
              
              const pmName = project.projectManager || 'To be assigned';
              const financeName = projectExt.financialDirector || 'To be assigned';
              const sponsorName = project.sponsor || 'To be assigned';
              
              return (
                <div className="grid grid-cols-3 gap-4 max-w-4xl mx-auto">
                  {/* Project Manager Signature */}
                  <div className={`p-4 rounded-lg border ${pmSig ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-background border-border/50'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-primary/60" />
                      <span className="text-xs font-medium uppercase tracking-wide">Project Manager</span>
                      {pmSig && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                    </div>
                    <div className="h-10 border-b border-dashed border-border mb-2 flex items-end justify-center">
                      {pmSig ? (
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 italic mb-1">{pmSig.signedByName || pmName}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic mb-1">{pmName}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{pmSig?.signedByName || pmName}</span>
                      <span>{pmSig?.signedAt ? formatDate(pmSig.signedAt) : '___________'}</span>
                    </div>
                  </div>
                  
                  {/* Financial Director Signature - Budget Approval */}
                  <div className={`p-4 rounded-lg border ${financeSig ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-background border-border/50'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-primary/60" />
                      <span className="text-xs font-medium uppercase tracking-wide">Financial Director</span>
                      {financeSig && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                    </div>
                    <div className="h-10 border-b border-dashed border-border mb-2 flex items-end justify-center">
                      {financeSig ? (
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 italic mb-1">{financeSig.signedByName || financeName}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic mb-1">{financeName}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{financeSig?.signedByName || financeName}</span>
                      <span>{financeSig?.signedAt ? formatDate(financeSig.signedAt) : '___________'}</span>
                    </div>
                    <div className="text-[9px] text-center text-blue-600 dark:text-blue-400 mt-2 font-medium">Budget Approval</div>
                  </div>
                  
                  {/* Executive Sponsor Signature */}
                  <div className={`p-4 rounded-lg border ${sponsorSig ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-background border-border/50'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-primary/60" />
                      <span className="text-xs font-medium uppercase tracking-wide">Executive Sponsor</span>
                      {sponsorSig && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                    </div>
                    <div className="h-10 border-b border-dashed border-border mb-2 flex items-end justify-center">
                      {sponsorSig ? (
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 italic mb-1">{sponsorSig.signedByName || sponsorName}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic mb-1">{sponsorName}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{sponsorSig?.signedByName || sponsorName}</span>
                      <span>{sponsorSig?.signedAt ? formatDate(sponsorSig.signedAt) : '___________'}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Document Footer */}
          <div className="bg-muted/20 border-t border-border/30 px-8 py-4 text-center">
            <p className="text-[11px] text-muted-foreground">
              This document is auto-generated from the approved Business Case and Demand Report.
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              {project.projectCode}-CHARTER-v1.0 | {formatDate(new Date())}
            </p>
          </div>
      </div>

      {/* Charter Actions - Below Document */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {!isLocked && (
          <>
            {!isEditMode ? (
              <Button 
                onClick={() => {
                  setEditData(getInitialEditData());
                  setIsEditMode(true);
                }}
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                data-testid="button-edit-charter"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Charter
              </Button>
            ) : (
              <>
                <Button 
                  onClick={() => setIsEditMode(false)}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-xs"
                  data-testid="button-cancel-edit"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </Button>
                <Button 
                  onClick={() => saveCharterMutation.mutate(editData)}
                  disabled={saveCharterMutation.isPending}
                  size="sm"
                  className="gap-1.5 h-8 text-xs"
                  data-testid="button-save-charter"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saveCharterMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            )}
          </>
        )}
        
        {!isEditMode && charterStatus === 'draft' && (
          <Button 
            onClick={() => sendForSignatureMutation.mutate()}
            disabled={sendForSignatureMutation.isPending}
            size="sm"
            className="gap-1.5 h-8 text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            data-testid="button-send-for-signature"
          >
            <Send className="w-3.5 h-3.5" />
            Send for Signature
          </Button>
        )}
        
        {charterStatus === 'pending_signature' && (
          <Button 
            onClick={() => signCharterMutation.mutate()}
            disabled={signCharterMutation.isPending}
            size="sm"
            className="gap-1.5 h-8 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
            data-testid="button-sign-charter"
          >
            <PenLine className="w-3.5 h-3.5" />
            {signCharterMutation.isPending ? 'Signing...' : 'Sign & Approve'}
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsGenerating(true)}
          disabled={isGenerating}
          className="gap-1.5 h-8 text-xs"
          data-testid="button-export-charter-pdf"
        >
          <FileText className="w-3.5 h-3.5" />
          Export PDF
        </Button>
      </div>
    </div>
  );
}
