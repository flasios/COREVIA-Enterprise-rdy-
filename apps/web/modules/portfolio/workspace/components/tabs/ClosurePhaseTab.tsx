import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2,
  FileText,
  Target,
  Shield,
  Users,
  Layers,
  Package,
  Flag,
} from 'lucide-react';

import type { ProjectData, StakeholderData, BusinessCaseData, DocumentData, ImplementationPhase, ApprovalData, GateData } from '../../types';

interface DeliverableSource {
  name?: string;
  deliverable?: string;
  title?: string;
  description?: string;
  status?: string;
  phase?: string;
}

interface DeliverableItem {
  name: string;
  phase?: string;
  description?: string;
  status?: string;
  source?: 'charter' | 'phase' | 'milestone' | 'expected';
}

interface MilestoneData {
  name?: string;
  milestone?: string;
  title?: string;
  description?: string;
  status?: string;
  date?: string;
  deliverables?: (string | DeliverableSource)[];
  outputs?: (string | DeliverableSource)[];
}

interface AcceptanceCriteriaItem {
  criteria?: string;
  name?: string;
}

interface ClosurePhaseTabProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  documents: DocumentData[];
  stakeholders: StakeholderData[];
  approvals?: ApprovalData[];
  gates?: GateData[];
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}

type ClosurePackage = {
  handoverDate?: string;
  operationsOwner?: string;
  supportModel?: string;
  archiveLocation?: string;
  lessonsLearned?: string;
  benefitsSummary?: string;
  checklist?: {
    docsArchived?: boolean;
    supportTransferred?: boolean;
    finalCommsSent?: boolean;
    financialsClosed?: boolean;
  };
};

export function ClosurePhaseTab({
  project,
  businessCase,
  documents,
  stakeholders,
  approvals = [],
  gates = [],
  activeSubTab: _activeSubTab = 'summary',
  onSubTabChange: _onSubTabChange,
}: ClosurePhaseTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bc = businessCase;
  const currentSubTab = _activeSubTab;

  const closurePackage = useMemo(() => {
    const raw = project.metadata?.closurePackage;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {} as ClosurePackage;
    return raw as ClosurePackage;
  }, [project.metadata]);

  const [handoverDate, setHandoverDate] = useState(closurePackage.handoverDate || '');
  const [operationsOwner, setOperationsOwner] = useState(closurePackage.operationsOwner || '');
  const [supportModel, setSupportModel] = useState(closurePackage.supportModel || '');
  const [archiveLocation, setArchiveLocation] = useState(closurePackage.archiveLocation || '');
  const [lessonsLearned, setLessonsLearned] = useState(closurePackage.lessonsLearned || '');
  const [benefitsSummary, setBenefitsSummary] = useState(closurePackage.benefitsSummary || '');
  const [docsArchived, setDocsArchived] = useState(Boolean(closurePackage.checklist?.docsArchived));
  const [supportTransferred, setSupportTransferred] = useState(Boolean(closurePackage.checklist?.supportTransferred));
  const [finalCommsSent, setFinalCommsSent] = useState(Boolean(closurePackage.checklist?.finalCommsSent));
  const [financialsClosed, setFinancialsClosed] = useState(Boolean(closurePackage.checklist?.financialsClosed));

  useEffect(() => {
    setHandoverDate(closurePackage.handoverDate || '');
    setOperationsOwner(closurePackage.operationsOwner || '');
    setSupportModel(closurePackage.supportModel || '');
    setArchiveLocation(closurePackage.archiveLocation || '');
    setLessonsLearned(closurePackage.lessonsLearned || '');
    setBenefitsSummary(closurePackage.benefitsSummary || '');
    setDocsArchived(Boolean(closurePackage.checklist?.docsArchived));
    setSupportTransferred(Boolean(closurePackage.checklist?.supportTransferred));
    setFinalCommsSent(Boolean(closurePackage.checklist?.finalCommsSent));
    setFinancialsClosed(Boolean(closurePackage.checklist?.financialsClosed));
  }, [closurePackage]);

  const closureGates = useMemo(
    () => gates.filter((gate) => String(gate.gateType || '').toLowerCase() === 'closure'),
    [gates],
  );
  const activeClosureGate = closureGates[0];
  const closureApprovals = useMemo(
    () => approvals.filter((approval) => {
      const kind = String(approval.approvalType || '').toLowerCase();
      const gateMatch = activeClosureGate ? approval.gateId === activeClosureGate.id : false;
      return gateMatch || ['document', 'milestone', 'gate_review', 'custom'].includes(kind);
    }),
    [approvals, activeClosureGate],
  );
  const approvedClosureApprovalsCount = useMemo(
    () => closureApprovals.filter((approval) => String(approval.status || '').toLowerCase() === 'approved').length,
    [closureApprovals],
  );

  const closureReadinessIssues = useMemo(() => {
    const issues: string[] = [];
    if (!handoverDate) issues.push('Set handover date');
    if (!operationsOwner.trim()) issues.push('Assign operations owner');
    if (!supportModel.trim()) issues.push('Define support model');
    if (!archiveLocation.trim()) issues.push('Set archive location');
    if (!lessonsLearned.trim()) issues.push('Capture lessons learned');
    if (!benefitsSummary.trim()) issues.push('Capture benefits summary');
    if (documents.length === 0) issues.push('Upload closure evidence documents');
    if (approvedClosureApprovalsCount === 0) issues.push('Approve at least one closure sign-off request');
    if (!docsArchived) issues.push('Confirm documentation archived');
    if (!supportTransferred) issues.push('Confirm support handover completed');
    if (!finalCommsSent) issues.push('Confirm final stakeholder communication sent');
    if (!financialsClosed) issues.push('Confirm financial close completed');
    return issues;
  }, [
    handoverDate,
    operationsOwner,
    supportModel,
    archiveLocation,
    lessonsLearned,
    benefitsSummary,
    documents.length,
    approvedClosureApprovalsCount,
    docsArchived,
    supportTransferred,
    finalCommsSent,
    financialsClosed,
  ]);
  const closureReadinessScore = Math.max(0, Math.round(((12 - closureReadinessIssues.length) / 12) * 100));
  const closureReadyForGateSubmission = closureReadinessIssues.length === 0;

  const saveClosurePackageMutation = useMutation({
    mutationFn: async () => {
      const nextMetadata = {
        ...(project.metadata || {}),
        closurePackage: {
          handoverDate,
          operationsOwner,
          supportModel,
          archiveLocation,
          lessonsLearned,
          benefitsSummary,
          checklist: {
            docsArchived,
            supportTransferred,
            finalCommsSent,
            financialsClosed,
          },
          updatedAt: new Date().toISOString(),
        },
      };
      const response = await apiRequest('PATCH', `/api/portfolio/projects/${project.id}`, {
        metadata: nextMetadata,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
      toast({ title: 'Closure package saved', description: 'Closure fields are now persisted for this project.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Unable to save closure package', description: error.message || 'Please retry.', variant: 'destructive' });
    },
  });

  const requestClosureApprovalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/portfolio/projects/${project.id}/approvals`, {
        approvalType: 'document',
        title: 'Project Closure Sign-off',
        description: `Closure sign-off request for ${project.projectName}`,
        priority: 'high',
        status: 'pending',
        dueDate: handoverDate || undefined,
        comments: benefitsSummary || undefined,
        gateId: activeClosureGate?.id,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
      toast({ title: 'Sign-off requested', description: 'A closure approval request has been submitted.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Unable to request sign-off', description: error.message || 'Please retry.', variant: 'destructive' });
    },
  });

  const decideApprovalMutation = useMutation({
    mutationFn: async ({ approvalId, decision }: { approvalId: string; decision: 'approved' | 'rejected' }) => {
      const response = await apiRequest('POST', `/api/portfolio/approvals/${approvalId}/decide`, {
        decision,
        comments: decision === 'approved' ? 'Closure package approved.' : 'Closure package requires revisions.',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
      toast({ title: 'Approval decision recorded', description: 'The closure approval decision has been saved.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Unable to record decision', description: error.message || 'Please retry.', variant: 'destructive' });
    },
  });

  const createClosureGateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/portfolio/projects/${project.id}/gates`, {
        gateName: 'Closure Gate Review',
        gateType: 'closure',
        gateOrder: 500,
        description: 'Final governance checkpoint before project closure.',
        plannedDate: handoverDate || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
      toast({ title: 'Closure gate created', description: 'Closure gate is now available in governance workflow.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Unable to create closure gate', description: error.message || 'Please retry.', variant: 'destructive' });
    },
  });

  const submitClosureGateMutation = useMutation({
    mutationFn: async () => {
      if (!activeClosureGate) throw new Error('No closure gate available.');
      const response = await apiRequest('PATCH', `/api/portfolio/projects/${project.id}/gates/${activeClosureGate.id}`, {
        status: 'submitted',
        reviewNotes: 'Submitted from closure workspace.',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
      toast({ title: 'Closure gate submitted', description: 'PMO can now review and approve closure.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Unable to submit gate', description: error.message || 'Please retry.', variant: 'destructive' });
    },
  });

  const allDeliverables = useMemo(() => {
    const deliverables: DeliverableItem[] = [];
    const seen = new Set<string>();

    const addDeliverable = (item: DeliverableItem) => {
      const key = item.name.toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        deliverables.push(item);
      }
    };

    if (!bc) return deliverables;

    const topLevel = bc?.deliverables || bc?.keyDeliverables || [];
    if (Array.isArray(topLevel)) {
      topLevel.forEach((del: string | DeliverableSource) => {
        const name = typeof del === 'string' ? del : (del.name || del.deliverable || del.title);
        if (name) {
          addDeliverable({
            name,
            phase: typeof del === 'object' ? del.phase : undefined,
            description: typeof del === 'object' ? del.description : undefined,
            status: (typeof del === 'object' ? del.status : undefined) || 'pending',
            source: 'charter'
          });
        }
      });
    }

    const expectedDeliverables = bc?.expectedDeliverables || bc?.content?.expectedDeliverables || [];
    if (Array.isArray(expectedDeliverables)) {
      expectedDeliverables.forEach((del: string | DeliverableSource) => {
        const name = typeof del === 'string' ? del : (del.name || del.deliverable || del.title);
        if (name) {
          addDeliverable({
            name,
            description: typeof del === 'object' ? del.description : undefined,
            status: (typeof del === 'object' ? del.status : undefined) || 'pending',
            source: 'expected'
          });
        }
      });
    }

    const phases = bc?.implementationPhases || bc?.implementationPlan?.phases || [];
    if (Array.isArray(phases)) {
      phases.forEach((phase: ImplementationPhase) => {
        const phaseName = phase.phase || phase.name || phase.title;
        const phaseDeliverables = phase.deliverables || [];
        if (Array.isArray(phaseDeliverables)) {
          phaseDeliverables.forEach((del: string | DeliverableSource) => {
            const name = typeof del === 'string' ? del : (del.name || del.deliverable || del.title);
            if (name) {
              addDeliverable({
                name,
                phase: phaseName,
                description: typeof del === 'object' ? del.description : undefined,
                status: (typeof del === 'object' ? del.status : undefined) || 'pending',
                source: 'phase'
              });
            }
          });
        }
      });
    }

    const milestones = bc?.milestones || [];
    if (Array.isArray(milestones)) {
      milestones.forEach((m: string | MilestoneData) => {
        const milestoneName = typeof m === 'object' ? (m.name || m.milestone || m.title) : m;
        if (milestoneName) {
          addDeliverable({
            name: milestoneName,
            description: typeof m === 'object' ? m.description : undefined,
            status: (typeof m === 'object' ? m.status : undefined) || 'pending',
            source: 'milestone'
          });
        }
        const mDeliverables = (typeof m === 'object' ? (m.deliverables || m.outputs) : undefined) || [];
        if (Array.isArray(mDeliverables)) {
          mDeliverables.forEach((del: string | DeliverableSource) => {
            const name = typeof del === 'string' ? del : (del.name || del.deliverable);
            if (name) {
              addDeliverable({
                name,
                phase: milestoneName,
                description: typeof del === 'object' ? del.description : undefined,
                status: (typeof del === 'object' ? del.status : undefined) || 'pending',
                source: 'milestone'
              });
            }
          });
        }
      });
    }

    return deliverables;
  }, [bc]);

  const acceptanceCriteria = (bc?.acceptanceCriteria ||
    bc?.content?.acceptanceCriteria || []) as (string | AcceptanceCriteriaItem)[];

  const getSourceBadge = (source?: string) => {
    switch (source) {
      case 'charter':
        return <Badge variant="outline" className="text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30">Charter</Badge>;
      case 'phase':
        return <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Phase</Badge>;
      case 'milestone':
        return <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/30">Milestone</Badge>;
      case 'expected':
        return <Badge variant="outline" className="text-xs text-purple-600 dark:text-purple-400 border-purple-500/30">Expected</Badge>;
      default:
        return null;
    }
  };

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'milestone':
        return <Flag className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'phase':
        return <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
  };

  const renderSummary = () => (
    <div className="space-y-6">
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Project Deliverables
            </CardTitle>
            {allDeliverables.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {allDeliverables.length} Total
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {allDeliverables.map((del, i) => (
                <div key={i} className="p-3 bg-muted/40 border border-border/50 rounded-lg flex items-start gap-3" data-testid={`deliverable-item-${i}`}>
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    {getSourceIcon(del.source)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{del.name}</div>
                    {del.phase && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Phase: {del.phase}
                      </div>
                    )}
                    {del.description && (
                      <div className="text-xs text-muted-foreground mt-1">{del.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getSourceBadge(del.source)}
                    <Badge variant="outline" className="text-xs">
                      {del.status === 'completed' ? 'Done' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              ))}
              {!allDeliverables.length && (
                <div className="text-center py-8 text-muted-foreground/70">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>{t('projectWorkspace.closure.noDeliverablesInCharter')}</p>
                  <p className="text-xs mt-1">{t('projectWorkspace.closure.generateBusinessCaseForDeliverables')}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/60 border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Project Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-3 bg-muted/40 border border-border/50 rounded-lg flex items-start gap-3 hover-elevate cursor-pointer" data-testid={`document-item-${doc.id}`}>
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{doc.documentName}</div>
                      <div className="text-xs text-muted-foreground">{doc.documentType} • v{doc.version}</div>
                    </div>
                  </div>
                ))}
                {!documents.length && (
                  <div className="text-center py-8 text-muted-foreground/70">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>{t('projectWorkspace.closure.noDocumentsUploaded')}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Acceptance Criteria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {acceptanceCriteria.length > 0 ? acceptanceCriteria.map((criteria: string | AcceptanceCriteriaItem, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-muted/40 rounded" data-testid={`criteria-item-${i}`}>
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground/70 mt-0.5" />
                    <span className="text-sm">{typeof criteria === 'string' ? criteria : (criteria.criteria || criteria.name || '')}</span>
                  </div>
                )) : (
                  <div className="text-center py-8 text-muted-foreground/70">
                    No acceptance criteria defined
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Sign-off Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stakeholders.filter(s => s.stakeholderType === 'sponsor' || s.influenceLevel === 'high').map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg" data-testid={`signoff-stakeholder-${s.id}`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {(s.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.role || s.stakeholderType}</div>
                </div>
                <Badge variant="outline" className="text-xs flex-shrink-0">Pending</Badge>
              </div>
            ))}
            {!stakeholders.filter(s => s.stakeholderType === 'sponsor' || s.influenceLevel === 'high').length && (
              <div className="col-span-full text-center py-8 text-muted-foreground/70">
                No stakeholders require sign-off
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-600" />
            Closure Package Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-3 bg-muted/40 rounded-lg">
              <div className="text-xs text-muted-foreground">Deliverables</div>
              <div className="text-lg font-semibold">{allDeliverables.length}</div>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg">
              <div className="text-xs text-muted-foreground">Closure Docs</div>
              <div className="text-lg font-semibold">{documents.length}</div>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg">
              <div className="text-xs text-muted-foreground">Sign-off Items</div>
              <div className="text-lg font-semibold">{closureApprovals.length}</div>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg">
              <div className="text-xs text-muted-foreground">Closure Gates</div>
              <div className="text-lg font-semibold">{closureGates.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderDeliverables = () => (
    <Card className="bg-card/60 border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          Deliverables and Evidence Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="text-xs text-muted-foreground">Total Deliverables</div>
            <div className="text-xl font-semibold">{allDeliverables.length}</div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-xl font-semibold">
              {allDeliverables.filter((item) => String(item.status || '').toLowerCase() === 'completed').length}
            </div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="text-xs text-muted-foreground">Evidence Documents</div>
            <div className="text-xl font-semibold">{documents.length}</div>
          </div>
        </div>
        <ScrollArea className="h-[320px]">
          <div className="space-y-2">
            {allDeliverables.map((item, index) => (
              <div key={`${item.name}-${index}`} className="p-3 bg-muted/30 rounded-lg border border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{item.name}</p>
                  <Badge variant="outline" className="text-xs">
                    {String(item.status || 'pending').toLowerCase() === 'completed' ? 'Done' : 'Pending'}
                  </Badge>
                </div>
                {item.phase && <p className="text-xs text-muted-foreground mt-1">Phase: {item.phase}</p>}
                {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
              </div>
            ))}
            {!allDeliverables.length && (
              <p className="text-sm text-muted-foreground text-center py-8">No deliverables available.</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderSignoff = () => (
    <div className="space-y-6">
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Handover Fields
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="closure-handover-date">Handover Date</Label>
              <Input id="closure-handover-date" type="date" value={handoverDate} onChange={(event) => setHandoverDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closure-ops-owner">Operations Owner</Label>
              <Input id="closure-ops-owner" value={operationsOwner} onChange={(event) => setOperationsOwner(event.target.value)} placeholder="Owner name or role" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="closure-support-model">Support Model</Label>
              <Input id="closure-support-model" value={supportModel} onChange={(event) => setSupportModel(event.target.value)} placeholder="L1-L2-L3, managed service, etc." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closure-archive-location">Archive Location</Label>
              <Input id="closure-archive-location" value={archiveLocation} onChange={(event) => setArchiveLocation(event.target.value)} placeholder="Repository / URL / DMS path" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveClosurePackageMutation.mutate()} disabled={saveClosurePackageMutation.isPending}>
              Save Closure Package
            </Button>
            <Button variant="outline" onClick={() => requestClosureApprovalMutation.mutate()} disabled={requestClosureApprovalMutation.isPending}>
              Request Closure Sign-off
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Approval Board
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[280px]">
            <div className="space-y-2">
              {closureApprovals.map((approval) => {
                const status = String(approval.status || '').toLowerCase();
                const canDecide = status === 'pending' || status === 'in_progress';
                return (
                  <div key={approval.id} className="p-3 bg-muted/30 rounded-lg border border-border/60">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{approval.approvalType.replace(/_/g, ' ')} approval</p>
                        <p className="text-xs text-muted-foreground">Status: {approval.status}</p>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">{approval.status}</Badge>
                    </div>
                    {approval.comments && <p className="text-xs text-muted-foreground mt-2">{approval.comments}</p>}
                    {canDecide && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => decideApprovalMutation.mutate({ approvalId: approval.id, decision: 'approved' })}
                          disabled={decideApprovalMutation.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decideApprovalMutation.mutate({ approvalId: approval.id, decision: 'rejected' })}
                          disabled={decideApprovalMutation.isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {!closureApprovals.length && <p className="text-sm text-muted-foreground text-center py-8">No closure approvals recorded yet.</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderLessons = () => (
    <Card className="bg-card/60 border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Lessons Learned and Benefits Realization
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="closure-lessons">Lessons Learned</Label>
          <Textarea
            id="closure-lessons"
            value={lessonsLearned}
            onChange={(event) => setLessonsLearned(event.target.value)}
            placeholder="Capture what worked, what failed, and what to improve in future projects."
            rows={6}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="closure-benefits">Benefits Summary</Label>
          <Textarea
            id="closure-benefits"
            value={benefitsSummary}
            onChange={(event) => setBenefitsSummary(event.target.value)}
            placeholder="Summarize realized outcomes against the original business case."
            rows={5}
          />
        </div>
        <Button onClick={() => saveClosurePackageMutation.mutate()} disabled={saveClosurePackageMutation.isPending}>
          Save Lessons and Benefits
        </Button>
      </CardContent>
    </Card>
  );

  const renderGovernance = () => (
    <Card className="bg-card/60 border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Closure Gate Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-muted/30 rounded-lg border border-border/60">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium">Closure Readiness</p>
            <Badge variant="outline" className="text-xs">{closureReadinessScore}%</Badge>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
            <div
              className={`h-full transition-all ${closureReadinessScore >= 90 ? 'bg-emerald-500' : closureReadinessScore >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${closureReadinessScore}%` }}
            />
          </div>
          {closureReadinessIssues.length > 0 ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {closureReadinessIssues.slice(0, 6).map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">All closure prerequisites are complete. Gate submission is enabled.</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-lg border border-border/60 p-3 bg-muted/20">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={docsArchived} onChange={(event) => setDocsArchived(event.target.checked)} />
            Documentation archived
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={supportTransferred} onChange={(event) => setSupportTransferred(event.target.checked)} />
            Support ownership transferred
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={finalCommsSent} onChange={(event) => setFinalCommsSent(event.target.checked)} />
            Final stakeholder communication sent
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={financialsClosed} onChange={(event) => setFinancialsClosed(event.target.checked)} />
            Financial close complete
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="text-xs text-muted-foreground">Closure Gates</div>
            <div className="text-xl font-semibold">{closureGates.length}</div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="text-xs text-muted-foreground">Gate Status</div>
            <div className="text-xl font-semibold capitalize">{activeClosureGate?.status || 'none'}</div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="text-xs text-muted-foreground">Sign-off Requests</div>
            <div className="text-xl font-semibold">{closureApprovals.filter((item) => String(item.status || '').toLowerCase() === 'pending').length}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!activeClosureGate && (
            <Button onClick={() => createClosureGateMutation.mutate()} disabled={createClosureGateMutation.isPending}>
              Create Closure Gate
            </Button>
          )}
          {activeClosureGate && (
            <Button
              variant="outline"
              onClick={() => submitClosureGateMutation.mutate()}
              disabled={
                submitClosureGateMutation.isPending ||
                String(activeClosureGate.status || '').toLowerCase() === 'submitted' ||
                !closureReadyForGateSubmission
              }
            >
              Submit Gate for PMO Review
            </Button>
          )}
          <Button variant="outline" onClick={() => saveClosurePackageMutation.mutate()} disabled={saveClosurePackageMutation.isPending}>
            Save Closure Readiness
          </Button>
          <Button variant="outline" onClick={() => requestClosureApprovalMutation.mutate()} disabled={requestClosureApprovalMutation.isPending}>
            Create Sign-off Request
          </Button>
        </div>

        <ScrollArea className="h-[260px]">
          <div className="space-y-2">
            {closureGates.map((gate) => (
              <div key={gate.id} className="p-3 bg-muted/30 rounded-lg border border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{gate.gateName}</p>
                  <Badge variant="outline" className="capitalize">{gate.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Type: {gate.gateType} | Order: {gate.gateOrder}</p>
                {gate.reviewNotes && <p className="text-xs text-muted-foreground mt-1">Notes: {gate.reviewNotes}</p>}
              </div>
            ))}
            {!closureGates.length && <p className="text-sm text-muted-foreground text-center py-8">No closure gate exists yet.</p>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {currentSubTab === 'summary' && renderSummary()}
      {currentSubTab === 'deliverables' && renderDeliverables()}
      {currentSubTab === 'signoff' && renderSignoff()}
      {currentSubTab === 'lessons' && renderLessons()}
      {currentSubTab === 'governance' && renderGovernance()}
    </div>
  );
}
