import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  FileText, Download, Sparkles, CheckCircle2, AlertTriangle, 
  Loader2, Building, Target, ClipboardList, Scale as _Scale, Shield, RefreshCw,
  Printer, Share2, Clock, Award, Users, Calendar, DollarSign as _DollarSign,
  ArrowRight, BookOpen, Gavel, FileCheck, Briefcase as _Briefcase, TrendingUp,
  CheckSquare as _CheckSquare, AlertCircle, Info, ExternalLink as _ExternalLink, Copy, Mail,
  Globe as _Globe, Lock, Database, Settings, Cpu, GraduationCap, Leaf as _Leaf,
  Server, Network, Cloud as _Cloud, Key as _Key, FileWarning as _FileWarning, HelpCircle as _HelpCircle, Phone,
  MapPin, FileSignature, Banknote, ListChecks, Layers as _Layers, Zap,
  BarChart3, PieChart as _PieChart, Activity, ShieldCheck, UserCheck, Bot, Languages,
  Edit, Save, X, History, GitBranch, Plus as _Plus, Trash2 as _Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { VersionHistoryTimeline } from '@/components/shared/versioning';

interface StructuredRequirement {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'mandatory' | 'required' | 'optional';
  source: 'demand' | 'template';
}

interface StructuredStakeholder {
  name: string;
  role: string;
  department: string;
  responsibility: string;
  source: 'demand' | 'template';
}

interface TenderSections {
  executiveSummary: string;
  projectBackground: string;
  scopeOfWork: string;
  technicalRequirements: string[];
  functionalRequirements: string[];
  structuredTechnicalRequirements?: StructuredRequirement[];
  structuredFunctionalRequirements?: StructuredRequirement[];
  integrationRequirements?: StructuredRequirement[];
  securityRequirements?: StructuredRequirement[];
  stakeholders?: StructuredStakeholder[];
  evaluationCriteria: {
    criterion: string;
    weight: number;
    scoringMethod: string;
  }[];
  termsAndConditions: string[];
  complianceChecks: {
    regulation: string;
    status: 'pass' | 'warning' | 'fail';
    notes: string;
  }[];
  innovationRequirements?: string;
  operationalRequirements?: string;
  trainingRequirements?: string;
  localizationRequirements?: string;
  vendorQualifications?: string;
  submissionInstructions?: string;
  projectTimeline?: string;
  commercialTerms?: string;
  additionalTerms?: string;
}

interface TenderPackage {
  id: string;
  businessCaseId: string;
  documentData: TenderSections;
  status: 'draft' | 'review' | 'published';
  generatedAt: string;
  publishedAt?: string;
}

interface RfpDocumentTabProps {
  demandReportId: string;
  projectName?: string;
  organizationName?: string;
}

export function RfpDocumentTab({ demandReportId, projectName, organizationName }: RfpDocumentTabProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const documentRef = useRef<HTMLDivElement>(null);
  const [generationProgress, setGenerationProgress] = useState<{ message: string; percentage: number } | null>(null);
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedSections, setEditedSections] = useState<TenderSections | null>(null);
  const [originalSections, setOriginalSections] = useState<TenderSections | null>(null);
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [versionType, setVersionType] = useState<'major' | 'minor' | 'patch'>('minor');
  const [changeSummary, setChangeSummary] = useState('');
  
  // Approval workflow state
  const [showApprovalPanel, setShowApprovalPanel] = useState(true);
  const [approvalComments, setApprovalComments] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'submit' | 'approve' | 'reject' | 'final'>('submit');

  const { data: tenderData, isLoading: isLoadingTender, refetch } = useQuery<{ success: boolean; data: TenderPackage[] }>({
    queryKey: ['/api/tenders/demand', demandReportId],
    enabled: !!demandReportId,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: demandData } = useQuery<{ success: boolean; data: any }>({
    queryKey: ['/api/demand-reports', demandReportId],
    enabled: !!demandReportId,
  });

  const tender = tenderData?.data?.[0];
  const sections = tender?.documentData;
  const demand = demandData?.data;
  
  // Fetch versions for this RFP (independent from demand report versions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: versionsData, refetch: refetchVersions } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['/api/tenders', tender?.id, 'versions'],
    enabled: !!tender?.id,
  });
  
  const versions = versionsData?.data || [];
  const latestVersion = versions[0];
  
  // Display sections - either edited or original
  const displaySections = isEditMode && editedSections ? editedSections : sections;
  
  // Initialize edit mode
  useEffect(() => {
    if (sections && isEditMode && !editedSections) {
      setEditedSections(JSON.parse(JSON.stringify(sections)));
      setOriginalSections(JSON.parse(JSON.stringify(sections)));
      setChangedFields(new Set());
    }
  }, [sections, isEditMode, editedSections]);
  
  // Track changes
  useEffect(() => {
    if (!editedSections || !originalSections) return;
    
    const changes = new Set<string>();
    
    // Compare each field
    if (editedSections.executiveSummary !== originalSections.executiveSummary) changes.add('executiveSummary');
    if (editedSections.projectBackground !== originalSections.projectBackground) changes.add('projectBackground');
    if (editedSections.scopeOfWork !== originalSections.scopeOfWork) changes.add('scopeOfWork');
    if (JSON.stringify(editedSections.technicalRequirements) !== JSON.stringify(originalSections.technicalRequirements)) changes.add('technicalRequirements');
    if (JSON.stringify(editedSections.functionalRequirements) !== JSON.stringify(originalSections.functionalRequirements)) changes.add('functionalRequirements');
    if (JSON.stringify(editedSections.evaluationCriteria) !== JSON.stringify(originalSections.evaluationCriteria)) changes.add('evaluationCriteria');
    if (JSON.stringify(editedSections.termsAndConditions) !== JSON.stringify(originalSections.termsAndConditions)) changes.add('termsAndConditions');
    if (JSON.stringify(editedSections.structuredTechnicalRequirements) !== JSON.stringify(originalSections.structuredTechnicalRequirements)) changes.add('structuredTechnicalRequirements');
    if (JSON.stringify(editedSections.structuredFunctionalRequirements) !== JSON.stringify(originalSections.structuredFunctionalRequirements)) changes.add('structuredFunctionalRequirements');
    if (JSON.stringify(editedSections.integrationRequirements) !== JSON.stringify(originalSections.integrationRequirements)) changes.add('integrationRequirements');
    if (JSON.stringify(editedSections.securityRequirements) !== JSON.stringify(originalSections.securityRequirements)) changes.add('securityRequirements');
    if (JSON.stringify(editedSections.stakeholders) !== JSON.stringify(originalSections.stakeholders)) changes.add('stakeholders');
    
    setChangedFields(changes);
  }, [editedSections, originalSections]);
  
  // Field update handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFieldUpdate = (field: keyof TenderSections, value: any) => {
    if (!editedSections) return;
    setEditedSections(prev => prev ? { ...prev, [field]: value } : null);
  };
  
  // Handle edit toggle
  const handleEditToggle = () => {
    if (isEditMode) {
      if (changedFields.size > 0) {
        if (window.confirm(t('common.confirmUnsavedDiscard'))) {
          setEditedSections(null);
          setOriginalSections(null);
          setChangedFields(new Set());
          setIsEditMode(false);
        }
      } else {
        setEditedSections(null);
        setOriginalSections(null);
        setIsEditMode(false);
      }
    } else {
      setIsEditMode(true);
    }
  };
  
  // Save changes handler
  const handleSaveChanges = () => {
    if (!editedSections || changedFields.size === 0) {
      toast({
        title: t('projectWorkspace.toast.noChanges'),
        description: t('projectWorkspace.toast.noChangesDesc'),
      });
      return;
    }
    setShowVersionDialog(true);
  };
  
  // Handle version created
  const handleVersionCreated = () => {
    setEditedSections(null);
    setOriginalSections(null);
    setChangedFields(new Set());
    setIsEditMode(false);
    setShowVersionDialog(false);
    queryClient.invalidateQueries({ queryKey: ['/api/tenders/demand', demandReportId] });
    queryClient.invalidateQueries({ queryKey: ['/api/tenders', tender?.id, 'versions'] });
    refetchVersions();
    toast({
      title: t('projectWorkspace.toast.versionCreated'),
      description: t('projectWorkspace.toast.versionCreatedDesc'),
    });
  };
  
  // Generate changes summary for version dialog
  const generateChangesSummary = () => {
    const changesArray = Array.from(changedFields);
    const fieldNames: Record<string, string> = {
      executiveSummary: 'Executive Summary',
      projectBackground: 'Project Background',
      scopeOfWork: 'Scope of Work',
      technicalRequirements: 'Technical Requirements',
      functionalRequirements: 'Functional Requirements',
      evaluationCriteria: 'Evaluation Criteria',
      termsAndConditions: 'Terms & Conditions',
      structuredTechnicalRequirements: 'Structured Technical Requirements',
      structuredFunctionalRequirements: 'Structured Functional Requirements',
      integrationRequirements: 'Integration Requirements',
      securityRequirements: 'Security Requirements',
      stakeholders: 'Stakeholders',
      innovationRequirements: 'Innovation & Emerging Technology',
      operationalRequirements: 'Operational & Support Requirements',
      trainingRequirements: 'Training & Knowledge Transfer',
      localizationRequirements: 'Localization & Emiratization',
      vendorQualifications: 'Vendor Qualifications',
      submissionInstructions: 'Submission Instructions',
      projectTimeline: 'Timeline & Milestones',
      commercialTerms: 'Commercial & Pricing',
      additionalTerms: 'Additional Terms & Conditions',
    };
    return changesArray.map(f => fieldNames[f] || f).join(', ');
  };
  
  // Save mutation for updating tender document
  const _updateTenderMutation = useMutation({
    mutationFn: async (data: { documentData: TenderSections }) => {
      const res = await apiRequest('PATCH', `/api/tenders/${tender?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      refetch();
    },
  });
  
  // RFP Document Version creation mutation (independent from demand report versions)
  const createRfpVersionMutation = useMutation({
    mutationFn: async (data: {
      versionType: 'major' | 'minor' | 'patch';
      changeSummary: string;
      editReason?: string;
      documentSnapshot: TenderSections;
      changedSections: string[];
    }) => {
      // Calculate version numbers based on latest version
      let major = 1, minor = 0, patch = 0;
      if (latestVersion) {
        major = latestVersion.major_version || latestVersion.majorVersion || 1;
        minor = latestVersion.minor_version || latestVersion.minorVersion || 0;
        patch = latestVersion.patch_version || latestVersion.patchVersion || 0;
        
        if (data.versionType === 'major') {
          major += 1;
          minor = 0;
          patch = 0;
        } else if (data.versionType === 'minor') {
          minor += 1;
          patch = 0;
        } else {
          patch += 1;
        }
      }
      
      const versionNumber = `v${major}.${minor}.${patch}`;
      
      const res = await apiRequest('POST', `/api/tenders/${tender?.id}/versions`, {
        versionNumber,
        majorVersion: major,
        minorVersion: minor,
        patchVersion: patch,
        documentSnapshot: data.documentSnapshot,
        changeSummary: data.changeSummary,
        changedSections: data.changedSections,
        editReason: data.editReason,
        parentVersionId: latestVersion?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      handleVersionCreated();
    },
    onError: (error: Error) => {
      toast({
        title: t('projectWorkspace.toast.versionCreationFailed'),
        description: error.message || t('projectWorkspace.toast.failedCreateVersionDesc'),
        variant: 'destructive',
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      setGenerationProgress({ message: 'Initializing AI document generation...', percentage: 10 });
      const res = await apiRequest('POST', `/api/tenders/generate/${demandReportId}`);
      return res.json();
    },
    onSuccess: () => {
      setGenerationProgress(null);
      toast({
        title: t('projectWorkspace.toast.rfpGeneratedSaved'),
        description: t('projectWorkspace.toast.rfpGeneratedSavedDesc'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenders/demand', demandReportId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tenders'] });
    },
    onError: (error: Error) => {
      setGenerationProgress(null);
      toast({
        title: t('projectWorkspace.toast.generationFailed'),
        description: error.message || t('projectWorkspace.toast.failedGenerateRfpDesc'),
        variant: 'destructive',
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PATCH', `/api/tenders/${tender?.id}`, { status: 'published' });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t('projectWorkspace.toast.rfpPublished'),
        description: t('projectWorkspace.toast.rfpPublishedDesc'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenders/demand', demandReportId] });
    },
    onError: (error: Error) => {
      toast({
        title: t('projectWorkspace.toast.publishFailed'),
        description: error.message || t('projectWorkspace.toast.failedPublishRfpDesc'),
        variant: 'destructive',
      });
    },
  });

  // Approval workflow mutation - Submit for Review
  const submitForReviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PATCH', `/api/tenders/${tender?.id}`, {
        status: 'review',
        submittedForReviewAt: new Date().toISOString(),
        submittedForReviewBy: 'Current User',
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t('projectWorkspace.toast.submittedForReview'),
        description: t('projectWorkspace.toast.submittedForReviewDesc'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenders/demand', demandReportId] });
      setShowApprovalDialog(false);
      setApprovalComments('');
    },
  });

  // Approval workflow mutation - Approve RFP
  const approveRfpMutation = useMutation({
    mutationFn: async (comments: string) => {
      const res = await apiRequest('PATCH', `/api/tenders/${tender?.id}`, {
        status: 'published',
        approvedAt: new Date().toISOString(),
        approvedBy: 'Current User',
        approvalComments: comments,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t('projectWorkspace.toast.rfpApproved'),
        description: t('projectWorkspace.toast.rfpApprovedDesc'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenders/demand', demandReportId] });
      setShowApprovalDialog(false);
      setApprovalComments('');
    },
  });

  // Approval workflow mutation - Reject RFP
  const rejectRfpMutation = useMutation({
    mutationFn: async (comments: string) => {
      const res = await apiRequest('PATCH', `/api/tenders/${tender?.id}`, {
        status: 'draft',
        rejectedAt: new Date().toISOString(),
        rejectedBy: 'Current User',
        rejectionReason: comments,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t('projectWorkspace.toast.rfpReturned'),
        description: t('projectWorkspace.toast.rfpReturnedDesc'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenders/demand', demandReportId] });
      setShowApprovalDialog(false);
      setApprovalComments('');
    },
  });

  const handleApprovalAction = (action: 'submit' | 'approve' | 'reject' | 'final') => {
    setApprovalAction(action);
    setShowApprovalDialog(true);
  };

  const executeApprovalAction = () => {
    switch (approvalAction) {
      case 'submit':
        submitForReviewMutation.mutate();
        break;
      case 'approve':
      case 'final':
        approveRfpMutation.mutate(approvalComments);
        break;
      case 'reject':
        rejectRfpMutation.mutate(approvalComments);
        break;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: t('projectWorkspace.toast.linkCopied'), description: t('projectWorkspace.toast.linkCopiedDesc') });
  };

  const complianceScore = sections?.complianceChecks?.filter(c => c.status === 'pass').length || 0;
  const totalChecks = sections?.complianceChecks?.length || 0;
  const compliancePercentage = totalChecks > 0 ? Math.round((complianceScore / totalChecks) * 100) : 0;
  const totalRequirements = (sections?.technicalRequirements?.length || 0) + (sections?.functionalRequirements?.length || 0);

  const referenceNumber = `RFP-${new Date().getFullYear()}-${demandReportId?.substring(0, 6).toUpperCase() || 'XXXXXX'}`;
  const issueDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const submissionDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const TemplateIndicator = ({ label = t('projectWorkspace.rfp.standardTemplate') }: { label?: string }) => (
    <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground border-dashed ml-2">
      {label}
    </Badge>
  );

  const DemandDerivedBadge = () => (
    <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30 ml-2">
      From Demand
    </Badge>
  );

  const formatStructuredObject = (obj: Record<string, unknown>): string => {
    const name = obj.name || obj.title || obj.label || '';
    const role = obj.role || obj.type || obj.category || '';
    const desc = obj.description || obj.value || obj.details || '';
    
    const parts: string[] = [];
    if (name) parts.push(String(name));
    if (role) parts.push(`(${String(role)})`);
    if (desc && desc !== name) parts.push(`- ${String(desc)}`);
    
    if (parts.length > 0) return parts.join(' ');
    
    const entries = Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .slice(0, 3);
    if (entries.length > 0) {
      return entries.map(([k, v]) => `${k}: ${String(v)}`).join(', ');
    }
    return JSON.stringify(obj, null, 2);
  };

  const renderDemandField = (field: unknown): string => {
    if (field === null || field === undefined) return '';
    if (typeof field === 'string') return field;
    if (Array.isArray(field)) {
      return field.map(item => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          return formatStructuredObject(item as Record<string, unknown>);
        }
        return String(item);
      }).join('\n');
    }
    if (typeof field === 'object') {
      return formatStructuredObject(field as Record<string, unknown>);
    }
    return String(field);
  };

  const renderDemandFieldAsList = (field: unknown): string[] => {
    if (field === null || field === undefined) return [];
    if (typeof field === 'string') {
      return field.split(/[\n,;]/).map(s => s.trim()).filter(Boolean);
    }
    if (Array.isArray(field)) {
      return field.map(item => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          return formatStructuredObject(item as Record<string, unknown>);
        }
        return String(item);
      }).filter(Boolean);
    }
    if (typeof field === 'object') {
      return [formatStructuredObject(field as Record<string, unknown>)];
    }
    return [String(field)];
  };

  const hasDemandField = (field: unknown): boolean => {
    if (field === null || field === undefined) return false;
    if (typeof field === 'string') return field.trim().length > 0;
    if (Array.isArray(field)) return field.length > 0;
    if (typeof field === 'object') return Object.keys(field as object).length > 0;
    return Boolean(field);
  };

  if (isLoadingTender) {
    return (
      <Card className="bg-card/60 border-border">
        <CardContent className="p-12 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading RFP document...</p>
        </CardContent>
      </Card>
    );
  }

  if (!tender || !sections) {
    return (
      <div className="space-y-6">
        <Card className="bg-card/60 border-border">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="p-4 rounded-xl bg-indigo-500/10">
                <Sparkles className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl font-semibold mb-2">Generate RFP Document</h2>
                <p className="text-sm text-muted-foreground">
                  Create a professional Request for Proposal with requirements, vendor qualifications, 
                  evaluation criteria, and UAE regulatory compliance.
                </p>
              </div>
              <Button 
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                data-testid="button-generate-rfp"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate RFP
                  </>
                )}
              </Button>
            </div>
            {generationProgress && (
              <div className="mt-6 max-w-md mx-auto">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">{generationProgress.message}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">{generationProgress.percentage}%</span>
                </div>
                <Progress value={generationProgress.percentage} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-0" ref={documentRef}>
      {/* Document Actions Bar - Sticky */}
      <div className="flex items-center justify-between gap-4 flex-wrap sticky top-0 z-20 bg-background/95 backdrop-blur py-3 px-4 -mx-4 mb-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/20">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Request for Proposal</h2>
            <p className="text-xs text-muted-foreground">Reference: {referenceNumber}</p>
          </div>
          <Badge 
            variant={tender.status === 'published' ? 'default' : 'secondary'}
            className="ml-2"
            data-testid="rfp-status-badge"
          >
            {tender.status === 'published' ? 'Published' : tender.status === 'review' ? 'In Review' : 'Draft'}
          </Badge>
          {isEditMode && (
            <Badge variant="outline" className="ml-1 text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
              <Edit className="w-3 h-3 mr-1" />
              Editing Mode
              {changedFields.size > 0 && ` (${changedFields.size} changes)`}
            </Badge>
          )}
          {!isEditMode && (
            <Badge variant="outline" className="ml-1 text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Saved to Tender Documents
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Edit Mode Controls */}
          {isEditMode ? (
            <>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleEditToggle}
                data-testid="button-cancel-edit"
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSaveChanges}
                disabled={changedFields.size === 0}
                data-testid="button-save-rfp-changes"
              >
                <Save className="w-4 h-4 mr-1" />
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => refetch()} data-testid="button-refresh-rfp">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCopyLink}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handlePrint}>
                <Printer className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="gap-1.5"
                onClick={() => setShowVersionPanel(true)}
                data-testid="button-version-history"
              >
                <History className="w-3.5 h-3.5" />
                Version History
              </Button>
              {tender.status !== 'published' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleEditToggle}
                  data-testid="button-edit-rfp"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Document
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5" data-testid="button-download-rfp">
                <Download className="w-3.5 h-3.5" />
                Export PDF
              </Button>
              {tender.status !== 'published' && (
                <Button 
                  size="sm" 
                  className="gap-1.5"
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  data-testid="button-publish-rfp"
                >
                  {publishMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                  Publish to Vendors
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* RFP Version Dialog - Independent from demand report versioning */}
      <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-primary" />
              Save RFP Document Version
            </DialogTitle>
            <DialogDescription>
              Create a new version of this RFP document with your changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Version Type</Label>
              <Select 
                value={versionType} 
                onValueChange={(v: 'major' | 'minor' | 'patch') => setVersionType(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="major">Major - Significant structural changes</SelectItem>
                  <SelectItem value="minor">Minor - Content updates and additions</SelectItem>
                  <SelectItem value="patch">Patch - Minor corrections and fixes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Changed Sections</Label>
              <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                {generateChangesSummary() || 'No changes detected'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-summary">Change Summary</Label>
              <Textarea
                id="change-summary"
                placeholder="Describe the changes made to this version..."
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVersionDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!editedSections) return;
                createRfpVersionMutation.mutate({
                  versionType,
                  changeSummary: changeSummary || generateChangesSummary(),
                  documentSnapshot: editedSections,
                  changedSections: Array.from(changedFields),
                });
              }}
              disabled={createRfpVersionMutation.isPending}
            >
              {createRfpVersionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Version'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Version History Panel */}
      <Sheet open={showVersionPanel} onOpenChange={setShowVersionPanel}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              RFP Version History
            </SheetTitle>
            <SheetDescription>
              Track all changes made to this RFP document with full version control.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {versions.length > 0 ? (
              <VersionHistoryTimeline
                versions={versions}
                reportId={demandReportId}
                onViewVersion={(versionId: string) => {
                  toast({ title: t('projectWorkspace.toast.viewingVersion'), description: t('projectWorkspace.toast.viewingVersionDesc', { versionId }) });
                }}
                onCompareVersions={(v1: string, v2: string) => {
                  toast({ title: t('projectWorkspace.toast.comparingVersions'), description: t('projectWorkspace.toast.comparingVersionsDesc', { v1, v2 }) });
                }}
                onRestoreVersion={(versionId: string) => {
                  toast({ title: t('projectWorkspace.toast.restoringVersion'), description: t('projectWorkspace.toast.restoringVersionDesc', { versionId }) });
                }}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No version history yet</p>
                <p className="text-sm">Make changes to the document to create versions</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Approval Workflow Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {approvalAction === 'submit' && <FileCheck className="w-5 h-5 text-blue-500" />}
              {approvalAction === 'approve' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {approvalAction === 'reject' && <AlertCircle className="w-5 h-5 text-red-500" />}
              {approvalAction === 'final' && <Award className="w-5 h-5 text-amber-500" />}
              {approvalAction === 'submit' && 'Submit RFP for Review'}
              {approvalAction === 'approve' && 'Approve RFP Document'}
              {approvalAction === 'reject' && 'Return RFP for Revision'}
              {approvalAction === 'final' && 'Final Approval'}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === 'submit' && 'Submit this RFP document to the procurement committee for review and approval.'}
              {approvalAction === 'approve' && 'Approve this RFP document for publication to vendors.'}
              {approvalAction === 'reject' && 'Return this document to the author with your feedback for revisions.'}
              {approvalAction === 'final' && 'Provide final approval to publish this RFP to vendors.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(approvalAction === 'approve' || approvalAction === 'reject' || approvalAction === 'final') && (
              <div className="space-y-2">
                <Label htmlFor="approval-comments">
                  {approvalAction === 'reject' ? 'Reason for Return *' : 'Comments (Optional)'}
                </Label>
                <Textarea
                  id="approval-comments"
                  placeholder={approvalAction === 'reject' ? 'Please explain what needs to be revised...' : 'Add any comments or conditions...'}
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            )}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">Document: {referenceNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Current Status: {tender?.status === 'published' ? 'Published' : tender?.status === 'review' ? 'In Review' : 'Draft'}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={executeApprovalAction}
              disabled={
                (approvalAction === 'reject' && !approvalComments.trim()) ||
                submitForReviewMutation.isPending ||
                approveRfpMutation.isPending ||
                rejectRfpMutation.isPending
              }
              variant={approvalAction === 'reject' ? 'destructive' : 'default'}
            >
              {(submitForReviewMutation.isPending || approveRfpMutation.isPending || rejectRfpMutation.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {approvalAction === 'submit' && 'Submit for Review'}
                  {approvalAction === 'approve' && 'Approve & Publish'}
                  {approvalAction === 'reject' && 'Return for Revision'}
                  {approvalAction === 'final' && 'Grant Final Approval'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RFP Approval Workflow Panel */}
      {showApprovalPanel && !isEditMode && (
        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
                <Gavel className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-indigo-900 dark:text-indigo-100">RFP Approval Workflow</h3>
                <p className="text-sm text-indigo-600 dark:text-indigo-300">
                  {tender?.status === 'draft' && 'Document is in draft mode. Submit for review when ready.'}
                  {tender?.status === 'review' && 'Document is pending approval from the procurement committee.'}
                  {tender?.status === 'published' && 'Document has been approved and published to vendors.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tender?.status === 'draft' && (
                <Button 
                  size="sm" 
                  onClick={() => handleApprovalAction('submit')}
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                  data-testid="button-submit-for-review"
                >
                  <FileCheck className="w-4 h-4" />
                  Submit for Review
                </Button>
              )}
              {tender?.status === 'review' && (
                <>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleApprovalAction('reject')}
                    className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                    data-testid="button-reject-rfp"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Return for Revision
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => handleApprovalAction('approve')}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    data-testid="button-approve-rfp"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve & Publish
                  </Button>
                </>
              )}
              {tender?.status === 'published' && (
                <Badge className="bg-emerald-500 text-white">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Approved & Published
                </Badge>
              )}
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowApprovalPanel(false)}
                className="text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Workflow Progress */}
          <div className="mt-4 flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              tender?.status === 'draft' ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200' : 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200'
            }`}>
              <div className={`w-2 h-2 rounded-full ${tender?.status === 'draft' ? 'bg-indigo-600' : 'bg-emerald-600'}`} />
              Draft
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              tender?.status === 'review' ? 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200' : 
              tender?.status === 'published' ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200' :
              'bg-muted text-muted-foreground'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                tender?.status === 'review' ? 'bg-amber-600' : 
                tender?.status === 'published' ? 'bg-emerald-600' : 'bg-muted-foreground'
              }`} />
              In Review
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              tender?.status === 'published' ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200' : 'bg-muted text-muted-foreground'
            }`}>
              <div className={`w-2 h-2 rounded-full ${tender?.status === 'published' ? 'bg-emerald-600' : 'bg-muted-foreground'}`} />
              Published
            </div>
          </div>
        </div>
      )}

      {/* ==================== FULL DOCUMENT START ==================== */}
      <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden print:shadow-none print:border-0">
        
        {/* COVER PAGE - Compact Professional Header */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 print:p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-indigo-300 border-indigo-500/50 bg-indigo-500/10 px-3 py-0.5 text-xs">
                  Official Government Tender
                </Badge>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">
                  <ShieldCheck className="w-3 h-3" />
                  UAE Compliant
                </div>
              </div>
              <div className="text-right text-xs text-slate-400">
                <span className="font-mono">{referenceNumber}</span>
                <span className="mx-2">|</span>
                <span>{issueDate}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <p className="text-indigo-300 uppercase tracking-widest text-[10px] mb-1">United Arab Emirates</p>
                <h1 className="text-2xl md:text-3xl font-bold mb-1">REQUEST FOR PROPOSAL</h1>
                <h2 className="text-lg text-indigo-200 font-medium">
                  {projectName || demand?.projectTitle || 'Not recorded'}
                </h2>
              </div>
              
              <div className="flex gap-4">
                <div className="p-3 rounded-lg bg-white/5 backdrop-blur border border-white/10 text-center min-w-[140px]">
                  <Building className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Issuing Authority</div>
                  <div className="text-xs font-medium truncate">{organizationName || demand?.organizationName || 'Not recorded'}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 backdrop-blur border border-white/10 text-center min-w-[140px]">
                  <Calendar className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Deadline</div>
                  <div className="text-xs font-medium">{submissionDeadline}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DOCUMENT BODY */}
        <div className="p-6 md:p-8 space-y-8 print:p-4 print:space-y-6">
          
          {/* Document Quality Summary - Compact */}
          <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="text-base font-bold text-emerald-500">{compliancePercentage}%</div>
                <div className="text-xs text-muted-foreground">Compliance</div>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="text-base font-bold text-blue-500">{totalRequirements}</div>
                <div className="text-xs text-muted-foreground">Requirements</div>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="text-base font-bold text-amber-500">{sections.evaluationCriteria?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Criteria</div>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="text-base font-bold text-purple-500">{sections.termsAndConditions?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Clauses</div>
              </div>
            </div>
          </div>

          {/* TABLE OF CONTENTS - Compact */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contents</h2>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-1 text-xs">
              {[
                { num: '1', title: 'Executive Summary' },
                { num: '2', title: 'Background' },
                { num: '3', title: 'Scope' },
                { num: '4', title: 'Technical Req.' },
                { num: '5', title: 'Functional Req.' },
                { num: '6', title: 'Innovation' },
                { num: '7', title: 'Integration' },
                { num: '8', title: 'Security' },
                { num: '9', title: 'Operations' },
                { num: '10', title: 'Training' },
                { num: '11', title: 'Localization' },
                { num: '12', title: 'Stakeholders' },
                { num: '13', title: 'Qualification' },
                { num: '14', title: 'Submission' },
                { num: '15', title: 'Evaluation' },
                { num: '16', title: 'Timeline' },
                { num: '17', title: 'Pricing' },
                { num: '18', title: 'Terms' },
              ].map((item) => (
                <div key={item.num} className="flex items-center gap-1 px-1.5 py-1 hover:bg-muted/50 rounded">
                  <span className="w-4 h-4 rounded bg-indigo-500/20 flex items-center justify-center text-indigo-500 font-bold text-[10px]">
                    {item.num}
                  </span>
                  <span className="truncate">{item.title}</span>
                </div>
              ))}
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 1: EXECUTIVE SUMMARY */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-bold">1</span>
              <h2 className="text-2xl font-bold">Executive Summary</h2>
              {isEditMode && changedFields.has('executiveSummary') && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Modified</Badge>
              )}
            </div>
            <div className="prose prose-lg dark:prose-invert max-w-none">
              {isEditMode ? (
                <Textarea
                  value={displaySections?.executiveSummary || ''}
                  onChange={(e) => handleFieldUpdate('executiveSummary', e.target.value)}
                  className="min-h-[300px] font-normal text-base"
                  placeholder="Enter executive summary..."
                  data-testid="textarea-executive-summary"
                />
              ) : (
                <p className="text-lg leading-relaxed whitespace-pre-wrap" data-testid="rfp-executive-summary">
                  {displaySections?.executiveSummary ?? 'Not recorded'}
                </p>
              )}
            </div>
            
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-amber-700 dark:text-amber-400">Important Notice</h4>
                  <p className="text-sm text-muted-foreground">
                    This is an official government procurement document. All information contained herein is confidential and intended solely for prospective vendors. Unauthorized distribution or disclosure is prohibited.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 2: INTRODUCTION & BACKGROUND */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-bold">2</span>
              <h2 className="text-2xl font-bold">Introduction & Background</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-500" />
                  2.1 About the Organization
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {(organizationName || demand?.organizationName)
                    ? `Issuing authority: ${organizationName || demand?.organizationName}.`
                    : 'Not recorded'}
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-500" />
                  2.2 Project Background
                  {isEditMode && changedFields.has('projectBackground') && (
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Modified</Badge>
                  )}
                </h3>
                <div className="prose dark:prose-invert max-w-none">
                  {isEditMode ? (
                    <Textarea
                      value={displaySections?.projectBackground || ''}
                      onChange={(e) => handleFieldUpdate('projectBackground', e.target.value)}
                      className="min-h-[250px] font-normal text-base"
                      placeholder="Enter project background..."
                      data-testid="textarea-project-background"
                    />
                  ) : (
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap" data-testid="rfp-project-background">
                      {displaySections?.projectBackground ?? 'Not recorded'}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  2.3 Strategic Alignment
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                    <h4 className="font-semibold mb-2">UAE Vision 2071</h4>
                    <p className="text-sm text-muted-foreground">Supporting the UAE's long-term development goals through digital innovation and service excellence.</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                    <h4 className="font-semibold mb-2">Digital Government Strategy</h4>
                    <p className="text-sm text-muted-foreground">Advancing paperless government operations and seamless digital citizen services.</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                    <h4 className="font-semibold mb-2">National AI Strategy</h4>
                    <p className="text-sm text-muted-foreground">Leveraging artificial intelligence to enhance decision-making and operational efficiency.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 3: PROJECT SCOPE & OBJECTIVES */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-bold">3</span>
              <h2 className="text-2xl font-bold">Project Scope & Objectives</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-500" />
                  3.1 Scope of Work
                  {isEditMode && changedFields.has('scopeOfWork') && (
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Modified</Badge>
                  )}
                </h3>
                <div className="prose dark:prose-invert max-w-none">
                  {isEditMode ? (
                    <Textarea
                      value={displaySections?.scopeOfWork || ''}
                      onChange={(e) => handleFieldUpdate('scopeOfWork', e.target.value)}
                      className="min-h-[250px] font-normal text-base"
                      placeholder="Enter scope of work..."
                      data-testid="textarea-scope-of-work"
                    />
                  ) : (
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap" data-testid="rfp-scope-of-work">
                      {displaySections?.scopeOfWork ?? 'Not recorded'}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-500" />
                  3.2 Project Objectives
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { title: 'Modernize Operations', desc: 'Replace legacy systems with modern, scalable technology platforms', icon: Cpu },
                    { title: 'Enhance User Experience', desc: 'Deliver intuitive, accessible digital services for all stakeholders', icon: Users },
                    { title: 'Improve Efficiency', desc: 'Automate manual processes and reduce operational overhead', icon: Zap },
                    { title: 'Enable Data-Driven Decisions', desc: 'Implement analytics capabilities for informed decision-making', icon: BarChart3 },
                    { title: 'Ensure Security', desc: 'Protect sensitive data with enterprise-grade security controls', icon: Shield },
                    { title: 'Support Scalability', desc: 'Build infrastructure capable of supporting future growth', icon: TrendingUp },
                  ].map((obj, i) => {
                    const Icon = obj.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                        <div className="p-2 rounded-lg bg-indigo-500/20">
                          <Icon className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{obj.title}</h4>
                          <p className="text-sm text-muted-foreground">{obj.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-purple-500" />
                  3.3 Deliverables
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>Deliverable</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Phase</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { id: 'D1', name: 'Project Charter', desc: 'Formal project initiation document with scope, objectives, and governance', phase: 'Initiation' },
                      { id: 'D2', name: 'Solution Design Document', desc: 'Detailed technical and functional design specifications', phase: 'Design' },
                      { id: 'D3', name: 'Configured Solution', desc: 'Fully configured and customized system ready for testing', phase: 'Build' },
                      { id: 'D4', name: 'Test Reports', desc: 'Comprehensive testing documentation including UAT sign-off', phase: 'Test' },
                      { id: 'D5', name: 'Training Materials', desc: 'User guides, admin manuals, and training curriculum', phase: 'Deploy' },
                      { id: 'D6', name: 'Go-Live Support', desc: 'Hypercare support during initial production period', phase: 'Deploy' },
                    ].map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono font-bold text-indigo-500">{d.id}</TableCell>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="text-muted-foreground">{d.desc}</TableCell>
                        <TableCell><Badge variant="outline">{d.phase}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 4: TECHNICAL REQUIREMENTS */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white font-bold">4</span>
              <h2 className="text-2xl font-bold">Technical Requirements</h2>
              {sections?.structuredTechnicalRequirements?.some(r => r.source === 'demand') ? <DemandDerivedBadge /> : <TemplateIndicator label={t('projectWorkspace.rfp.aiGenerated')} />}
              <Badge className="ml-auto bg-blue-500">{sections?.structuredTechnicalRequirements?.length || sections.technicalRequirements?.length || 0} Requirements</Badge>
            </div>

            <p className="text-muted-foreground mb-6">
              The following technical requirements represent mandatory specifications that vendors must address in their proposals. Each requirement is classified by priority and compliance status.
            </p>

            <div className="space-y-4" data-testid="rfp-technical-requirements">
              {sections?.structuredTechnicalRequirements?.length ? (
                sections.structuredTechnicalRequirements.map((req) => (
                  <div key={req.id} className="p-4 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/20 text-blue-500 font-bold flex-shrink-0">
                        {req.id}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">{req.priority || 'Mandatory'}</Badge>
                          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">{req.category || 'Technical'}</Badge>
                          {req.source === 'demand' ? <DemandDerivedBadge /> : <TemplateIndicator label={t('projectWorkspace.rfp.ai')} />}
                        </div>
                        <p className="leading-relaxed">{req.title}</p>
                        {req.description && req.description !== req.title && (
                          <p className="text-sm text-muted-foreground mt-2">{req.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : sections.technicalRequirements?.length ? (
                sections.technicalRequirements.map((req, i) => (
                  <div key={i} className="p-4 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/20 text-blue-500 font-bold flex-shrink-0">
                        T{String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">Mandatory</Badge>
                          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Technical</Badge>
                          <TemplateIndicator label={t('projectWorkspace.rfp.ai')} />
                        </div>
                        <p className="leading-relaxed">{req}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-lg">
                  Technical requirements will be populated based on your demand request specifications.
                </div>
              )}
            </div>

            {/* Technical Environment Specifications */}
            <div className="mt-8">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-500" />
                4.1 Technical Environment Specifications
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Specification</TableHead>
                    <TableHead>Requirement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { cat: 'Hosting', spec: 'Cloud Platform', req: 'UAE-based data centers with G-Cloud certification' },
                    { cat: 'Availability', spec: 'Uptime SLA', req: '99.9% availability with redundancy' },
                    { cat: 'Performance', spec: 'Response Time', req: '< 2 seconds for standard transactions' },
                    { cat: 'Scalability', spec: 'Concurrent Users', req: 'Support 10,000+ concurrent users' },
                    { cat: 'Database', spec: 'Data Storage', req: 'Enterprise-grade RDBMS with encryption at rest' },
                    { cat: 'Backup', spec: 'Recovery', req: 'RPO < 1 hour, RTO < 4 hours' },
                  ].map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.cat}</TableCell>
                      <TableCell>{row.spec}</TableCell>
                      <TableCell className="text-muted-foreground">{row.req}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 5: FUNCTIONAL REQUIREMENTS */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center text-white font-bold">5</span>
              <h2 className="text-2xl font-bold">Functional Requirements</h2>
              {sections?.structuredFunctionalRequirements?.some(r => r.source === 'demand') ? <DemandDerivedBadge /> : <TemplateIndicator label={t('projectWorkspace.rfp.aiGenerated')} />}
              <Badge className="ml-auto bg-purple-500">{sections?.structuredFunctionalRequirements?.length || sections.functionalRequirements?.length || 0} Requirements</Badge>
            </div>

            <p className="text-muted-foreground mb-6">
              Functional requirements define the business capabilities and user features that the solution must provide. Vendors should demonstrate how their proposed solution addresses each requirement.
            </p>

            <div className="space-y-4" data-testid="rfp-functional-requirements">
              {sections?.structuredFunctionalRequirements?.length ? (
                sections.structuredFunctionalRequirements.map((req) => (
                  <div key={req.id} className="p-4 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/20 text-purple-500 font-bold flex-shrink-0">
                        {req.id}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">{req.priority || 'Mandatory'}</Badge>
                          <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30">{req.category || 'Functional'}</Badge>
                          {req.source === 'demand' ? <DemandDerivedBadge /> : <TemplateIndicator label={t('projectWorkspace.rfp.ai')} />}
                        </div>
                        <p className="leading-relaxed">{req.title}</p>
                        {req.description && req.description !== req.title && (
                          <p className="text-sm text-muted-foreground mt-2">{req.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : sections.functionalRequirements?.length ? (
                sections.functionalRequirements.map((req, i) => (
                  <div key={i} className="p-4 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/20 text-purple-500 font-bold flex-shrink-0">
                        F{String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">Mandatory</Badge>
                          <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30">Functional</Badge>
                          <TemplateIndicator label={t('projectWorkspace.rfp.ai')} />
                        </div>
                        <p className="leading-relaxed">{req}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-lg">
                  Functional requirements will be populated based on your demand request specifications.
                </div>
              )}
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 6: INNOVATION & EMERGING TECHNOLOGY REQUIREMENTS */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                6
              </span>
              <h2 className="text-2xl font-bold">Innovation & Emerging Technology</h2>
              <TemplateIndicator label={t('projectWorkspace.rfp.strategic')} />
              {isEditMode && changedFields.has('innovationRequirements') && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Modified</Badge>
              )}
              <Badge className="ml-auto bg-gradient-to-r from-purple-500 to-pink-500">UAE Vision 2071</Badge>
            </div>

            {isEditMode ? (
              <Textarea
                value={displaySections?.innovationRequirements || 'The UAE Government prioritizes innovative solutions that align with national digital transformation goals. Vendors should demonstrate forward-thinking capabilities and emerging technology expertise.'}
                onChange={(e) => handleFieldUpdate('innovationRequirements', e.target.value)}
                className="min-h-[120px] font-normal text-base mb-6"
                placeholder="Enter innovation requirements overview..."
                data-testid="textarea-innovation-requirements"
              />
            ) : (
              <p className="text-muted-foreground mb-6">
                {displaySections?.innovationRequirements || 'The UAE Government prioritizes innovative solutions that align with national digital transformation goals. Vendors should demonstrate forward-thinking capabilities and emerging technology expertise.'}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/30">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-500" />
                  AI & Machine Learning Capabilities
                </h3>
                <ul className="space-y-3">
                  {[
                    'Intelligent automation for routine government processes',
                    'Predictive analytics for resource planning and optimization',
                    'Natural Language Processing for citizen engagement',
                    'Computer vision for document processing and verification',
                    'AI-driven decision support systems',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500 mt-1 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/30">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  Future-Ready Architecture
                </h3>
                <ul className="space-y-3">
                  {[
                    'Microservices architecture for scalability and flexibility',
                    'API-first design enabling seamless integration',
                    'Cloud-native deployment with multi-region support',
                    'Blockchain readiness for trusted transactions',
                    'IoT integration capabilities for smart city initiatives',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-6 bg-muted/30 rounded-lg border border-border/50">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Innovation Scoring Criteria
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Criterion</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { criterion: 'Technology Roadmap', weight: '20%', desc: 'Clear vision for future enhancements and emerging tech adoption' },
                    { criterion: 'R&D Investment', weight: '15%', desc: 'Demonstrated commitment to research and development' },
                    { criterion: 'Innovation Track Record', weight: '25%', desc: 'Evidence of successful innovative implementations' },
                    { criterion: 'Partnership Ecosystem', weight: '20%', desc: 'Collaborations with technology leaders and startups' },
                    { criterion: 'UAE-Specific Innovation', weight: '20%', desc: 'Solutions tailored to UAE government priorities' },
                  ].map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.criterion}</TableCell>
                      <TableCell><Badge variant="outline">{row.weight}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{row.desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 7: INTEGRATION REQUIREMENTS */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center text-white font-bold">7</span>
              <h2 className="text-2xl font-bold">Integration Requirements</h2>
            </div>

            <p className="text-muted-foreground mb-6">
              The proposed solution must integrate seamlessly with existing government systems and platforms. Vendors must demonstrate proven integration capabilities.
            </p>

            {/* Structured integration requirements from backend */}
            {sections?.integrationRequirements && sections.integrationRequirements.length > 0 ? (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <h4 className="font-semibold">Specified Integration Requirements</h4>
                  {sections.integrationRequirements.some(r => r.source === 'demand') ? <DemandDerivedBadge /> : <TemplateIndicator />}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sections.integrationRequirements.map((req) => (
                    <div key={req.id} className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono">{req.id}</Badge>
                          <span className="font-medium">{req.title}</span>
                        </div>
                        <Badge variant={req.priority === 'mandatory' ? 'default' : 'outline'} className="text-xs">
                          {req.priority}
                        </Badge>
                      </div>
                      {req.description !== req.title && (
                        <p className="text-sm text-muted-foreground">{req.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : hasDemandField(demand?.integrationRequirements) ? (
              <div className="mb-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Network className="w-4 h-4 text-cyan-500" />
                  Specified Integration Requirements
                  <DemandDerivedBadge />
                </h4>
                {renderDemandFieldAsList(demand?.integrationRequirements).length > 0 ? (
                  <ul className="space-y-2">
                    {renderDemandFieldAsList(demand?.integrationRequirements).map((req, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{renderDemandField(demand?.integrationRequirements)}</p>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { name: 'UAE PASS', desc: 'National digital identity platform for authentication', type: 'Identity', priority: 'Mandatory' },
                { name: 'FTA Systems', desc: 'Federal Tax Authority integration for compliance', type: 'Government', priority: 'Mandatory' },
                { name: 'Payment Gateway', desc: 'Secure payment processing integration', type: 'Financial', priority: 'Mandatory' },
                { name: 'Document Management', desc: 'Enterprise content management integration', type: 'Enterprise', priority: 'Optional' },
                { name: 'Email/Notification', desc: 'Communication and notification services', type: 'Communication', priority: 'Mandatory' },
                { name: 'Analytics Platform', desc: 'Business intelligence and reporting', type: 'Analytics', priority: 'Optional' },
              ].map((int, i) => (
                <div key={i} className="p-4 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Network className="w-5 h-5 text-cyan-500" />
                      <h4 className="font-semibold">{int.name}</h4>
                    </div>
                    <Badge variant={int.priority === 'Mandatory' ? 'default' : 'outline'} className="text-xs">
                      {int.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{int.desc}</p>
                  <Badge variant="outline" className="text-xs">{int.type}</Badge>
                </div>
              ))}
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 8: SECURITY & DATA GOVERNANCE */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center text-white font-bold">8</span>
              <h2 className="text-2xl font-bold">Security & Data Governance</h2>
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start gap-4">
                  <Shield className="w-8 h-8 text-red-500 flex-shrink-0" />
                  <div>
                    <h3 className="text-base font-semibold mb-2">Critical Security Notice</h3>
                    <p className="text-muted-foreground">
                      All solutions must comply with UAE Information Assurance Standards (IAS) and maintain data residency within UAE borders. Vendors must demonstrate ISO 27001 certification and SOC 2 Type II compliance.
                    </p>
                  </div>
                </div>
              </div>

              {/* Structured security requirements from backend */}
              {sections?.securityRequirements && sections.securityRequirements.length > 0 ? (
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                    <h4 className="font-semibold">Specified Compliance Requirements</h4>
                    {sections.securityRequirements.some(r => r.source === 'demand') ? <DemandDerivedBadge /> : <TemplateIndicator />}
                  </div>
                  <div className="space-y-3">
                    {sections.securityRequirements.map((req) => (
                      <div key={req.id} className="flex items-start gap-3 p-2 bg-background/50 rounded">
                        <Badge variant="outline" className="text-xs font-mono flex-shrink-0">{req.id}</Badge>
                        <div className="flex-1">
                          <span className="font-medium">{req.title}</span>
                          {req.description !== req.title && (
                            <p className="text-sm text-muted-foreground mt-1">{req.description}</p>
                          )}
                        </div>
                        <Badge variant={req.priority === 'mandatory' ? 'default' : 'outline'} className="text-xs flex-shrink-0">
                          {req.priority}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : hasDemandField(demand?.complianceRequirements) ? (
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                    Specified Compliance Requirements
                    <DemandDerivedBadge />
                  </h4>
                  {renderDemandFieldAsList(demand?.complianceRequirements).length > 0 ? (
                    <ul className="space-y-2">
                      {renderDemandFieldAsList(demand?.complianceRequirements).map((req, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <ShieldCheck className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{renderDemandField(demand?.complianceRequirements)}</p>
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-red-500" />
                    7.1 Security Requirements
                    <TemplateIndicator label={t('projectWorkspace.rfp.uaeIasStandard')} />
                  </h3>
                  <ul className="space-y-3">
                    {[
                      'Multi-factor authentication (MFA) for all users',
                      'Role-based access control (RBAC) implementation',
                      'End-to-end encryption for data in transit',
                      'AES-256 encryption for data at rest',
                      'Regular penetration testing and vulnerability assessments',
                      'Security incident response plan and procedures',
                      'Audit logging for all system activities',
                      'Secure API design with OAuth 2.0 / OpenID Connect',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1 flex-shrink-0" />
                        <span className="text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-500" />
                    7.2 Data Governance
                    <TemplateIndicator label={t('projectWorkspace.rfp.uaePdplStandard')} />
                  </h3>
                  <ul className="space-y-3">
                    {[
                      'Data classification and handling procedures',
                      'Personal data protection (UAE PDPL compliance)',
                      'Data retention and disposal policies',
                      'Cross-border data transfer restrictions',
                      'Data backup and recovery procedures',
                      'Data anonymization for analytics',
                      'Consent management for personal data',
                      'Right to erasure implementation',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                        <span className="text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 9: OPERATIONAL & SUPPORT REQUIREMENTS */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white font-bold">9</span>
              <h2 className="text-2xl font-bold">Operational & Support Requirements</h2>
              <TemplateIndicator label={t('projectWorkspace.rfp.standardSla')} />
              {isEditMode && changedFields.has('operationalRequirements') && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Modified</Badge>
              )}
            </div>

            {isEditMode && (
              <div className="mb-6">
                <Label className="text-sm font-medium mb-2 block">Additional Operational Requirements</Label>
                <Textarea
                  value={displaySections?.operationalRequirements || ''}
                  onChange={(e) => handleFieldUpdate('operationalRequirements', e.target.value)}
                  className="min-h-[100px] font-normal text-base"
                  placeholder="Enter additional operational and support requirements..."
                  data-testid="textarea-operational-requirements"
                />
              </div>
            )}
            {!isEditMode && displaySections?.operationalRequirements && (
              <p className="text-muted-foreground mb-6 whitespace-pre-wrap">{displaySections.operationalRequirements}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-muted/30 rounded-lg border border-border/50">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-orange-500" />
                  Support Model
                </h3>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Support Hours</TableCell>
                      <TableCell>24/7 for critical issues</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Response Time (P1)</TableCell>
                      <TableCell>15 minutes</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Response Time (P2)</TableCell>
                      <TableCell>2 hours</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Response Time (P3)</TableCell>
                      <TableCell>8 hours</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Language</TableCell>
                      <TableCell>Arabic & English</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="p-6 bg-muted/30 rounded-lg border border-border/50">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-orange-500" />
                  SLA Requirements
                </h3>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">System Availability</TableCell>
                      <TableCell>99.9% uptime</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Planned Maintenance</TableCell>
                      <TableCell>Outside business hours</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">P1 Resolution</TableCell>
                      <TableCell>4 hours</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">P2 Resolution</TableCell>
                      <TableCell>24 hours</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">P3 Resolution</TableCell>
                      <TableCell>5 business days</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 10: TRAINING & KNOWLEDGE TRANSFER */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center text-white font-bold">10</span>
              <h2 className="text-2xl font-bold">Training & Knowledge Transfer</h2>
              <TemplateIndicator label={t('projectWorkspace.rfp.standardProgram')} />
              {isEditMode && changedFields.has('trainingRequirements') && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Modified</Badge>
              )}
            </div>

            {isEditMode ? (
              <Textarea
                value={displaySections?.trainingRequirements || 'The vendor shall provide comprehensive training to ensure successful adoption of the solution. All training materials must be provided in both Arabic and English.'}
                onChange={(e) => handleFieldUpdate('trainingRequirements', e.target.value)}
                className="min-h-[120px] font-normal text-base mb-6"
                placeholder="Enter training and knowledge transfer requirements..."
                data-testid="textarea-training-requirements"
              />
            ) : (
              <p className="text-muted-foreground mb-6">
                {displaySections?.trainingRequirements || 'The vendor shall provide comprehensive training to ensure successful adoption of the solution. All training materials must be provided in both Arabic and English.'}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'End User Training', hours: 16, participants: 'All Users', format: 'Instructor-led + E-learning', icon: Users },
                { title: 'Administrator Training', hours: 24, participants: 'IT Team', format: 'Hands-on Workshop', icon: Settings },
                { title: 'Technical Training', hours: 40, participants: 'Developers', format: 'Deep Dive Sessions', icon: Cpu },
              ].map((training, i) => {
                const Icon = training.icon;
                return (
                  <div key={i} className="p-6 bg-muted/30 rounded-lg border border-border/50">
                    <Icon className="w-8 h-8 text-teal-500 mb-4" />
                    <h4 className="font-semibold mb-2">{training.title}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="font-medium">{training.hours} hours</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Audience</span>
                        <span className="font-medium">{training.participants}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Format</span>
                        <span className="font-medium">{training.format}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 11: LOCALIZATION & EMIRATIZATION REQUIREMENTS */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold">
                11
              </span>
              <h2 className="text-2xl font-bold">Localization & Emiratization</h2>
              <TemplateIndicator label={t('projectWorkspace.rfp.uaeMandatory')} />
              {isEditMode && changedFields.has('localizationRequirements') && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Modified</Badge>
              )}
              <Badge className="ml-auto bg-gradient-to-r from-green-500 to-emerald-600">ICV Required</Badge>
            </div>

            {isEditMode ? (
              <Textarea
                value={displaySections?.localizationRequirements || 'Vendors must demonstrate commitment to UAE localization requirements and Emiratization goals. This includes bilingual support, local content value (ICV), and national workforce development.'}
                onChange={(e) => handleFieldUpdate('localizationRequirements', e.target.value)}
                className="min-h-[120px] font-normal text-base mb-6"
                placeholder="Enter localization and Emiratization requirements..."
                data-testid="textarea-localization-requirements"
              />
            ) : (
              <p className="text-muted-foreground mb-6">
                {displaySections?.localizationRequirements || 'Vendors must demonstrate commitment to UAE localization requirements and Emiratization goals. This includes bilingual support, local content value (ICV), and national workforce development.'}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/30">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Languages className="w-5 h-5 text-green-500" />
                  Language Requirements
                </h3>
                <ul className="space-y-3">
                  {[
                    'Full Arabic language support (RTL interface)',
                    'English interface as secondary language',
                    'Arabic documentation and training materials',
                    'Arabic-speaking customer support',
                    'Arabic content in all reports and outputs',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-lg border border-emerald-500/30">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-500" />
                  ICV Requirements
                </h3>
                <ul className="space-y-3">
                  {[
                    'Valid ICV certificate from MOEC-approved certifier',
                    'Minimum ICV score as per tender requirements',
                    'Local manufacturing or service delivery',
                    'Investment in UAE operations',
                    'Partnership with local entities',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 bg-gradient-to-br from-teal-500/10 to-cyan-500/10 rounded-lg border border-teal-500/30">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-teal-500" />
                  Emiratization Goals
                </h3>
                <ul className="space-y-3">
                  {[
                    'Employment of UAE nationals in project team',
                    'Internship opportunities for Emirati students',
                    'Knowledge transfer to local workforce',
                    'Skills development programs',
                    'Career progression paths for UAE nationals',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-teal-500 mt-1 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-6 bg-muted/30 rounded-lg border border-border/50">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Building className="w-5 h-5 text-amber-500" />
                Cultural & Regulatory Compliance
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requirement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { req: 'Arabic Calendar Support', status: 'Mandatory', detail: 'Hijri and Gregorian calendar integration' },
                    { req: 'Local Currency', status: 'Mandatory', detail: 'AED as primary currency with proper formatting' },
                    { req: 'UAE Time Zone', status: 'Mandatory', detail: 'Gulf Standard Time (GST) as default' },
                    { req: 'UAE Holidays', status: 'Mandatory', detail: 'Automatic recognition of UAE public holidays' },
                    { req: 'Islamic Banking', status: 'If Applicable', detail: 'Sharia-compliant financial modules' },
                    { req: 'Data Residency', status: 'Mandatory', detail: 'Primary data storage within UAE borders' },
                  ].map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.req}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === 'Mandatory' ? 'default' : 'outline'} className="text-xs">
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.detail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <Separator className="my-8" />

          {/* KEY STAKEHOLDERS SECTION - from backend structured data or demand */}
          {(sections?.stakeholders && sections.stakeholders.length > 0) || hasDemandField(demand?.stakeholders) ? (
            <>
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <span className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-bold">
                    12
                  </span>
                  <h2 className="text-2xl font-bold">Key Stakeholders</h2>
                  {sections?.stakeholders?.some(s => s.source === 'demand') ? <DemandDerivedBadge /> : <TemplateIndicator />}
                </div>
                <p className="text-muted-foreground mb-4">
                  The following stakeholders are involved in this procurement and will participate in the evaluation process:
                </p>
                
                {sections?.stakeholders && sections.stakeholders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Responsibility</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sections.stakeholders.map((stakeholder, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{stakeholder.name}</TableCell>
                            <TableCell>{stakeholder.role}</TableCell>
                            <TableCell>{stakeholder.department}</TableCell>
                            <TableCell>{stakeholder.responsibility || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                    {renderDemandFieldAsList(demand?.stakeholders).length > 0 ? (
                      <ul className="space-y-2">
                        {renderDemandFieldAsList(demand?.stakeholders).map((stakeholder, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500 mt-1 flex-shrink-0" />
                            <span>{stakeholder}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="whitespace-pre-wrap">{renderDemandField(demand?.stakeholders)}</p>
                    )}
                  </div>
                )}
              </section>
              <Separator className="my-8" />
            </>
          ) : null}

          {/* SECTION 13: VENDOR QUALIFICATION CRITERIA */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white font-bold">13</span>
              <h2 className="text-2xl font-bold">Vendor Qualification Criteria</h2>
              {isEditMode && changedFields.has('vendorQualifications') && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Modified</Badge>
              )}
            </div>

            {isEditMode ? (
              <Textarea
                value={displaySections?.vendorQualifications || 'To be considered for this procurement, vendors must meet the following mandatory qualification criteria. Failure to meet any mandatory criterion will result in disqualification.'}
                onChange={(e) => handleFieldUpdate('vendorQualifications', e.target.value)}
                className="min-h-[120px] font-normal text-base mb-6"
                placeholder="Enter vendor qualification criteria..."
                data-testid="textarea-vendor-qualifications"
              />
            ) : (
              <p className="text-muted-foreground mb-6">
                {displaySections?.vendorQualifications || 'To be considered for this procurement, vendors must meet the following mandatory qualification criteria. Failure to meet any mandatory criterion will result in disqualification.'}
              </p>
            )}

            <div className="space-y-4">
              {[
                { title: 'Legal Entity Status', desc: 'Registered company in UAE or with valid UAE trade license/branch', mandatory: true },
                { title: 'Financial Stability', desc: 'Minimum 3 years audited financial statements showing positive equity', mandatory: true },
                { title: 'Relevant Experience', desc: 'At least 3 similar projects completed for government entities in GCC', mandatory: true },
                { title: 'Technical Certifications', desc: 'ISO 27001, ISO 9001, and relevant technology partner certifications', mandatory: true },
                { title: 'Local Presence', desc: 'Established office in UAE with local support team', mandatory: true },
                { title: 'Insurance Coverage', desc: 'Professional indemnity insurance of minimum AED 5 million', mandatory: true },
                { title: 'References', desc: 'Minimum 3 reference letters from government clients', mandatory: true },
                { title: 'Emirati Content', desc: 'Demonstrated commitment to ICV program and Emiratization', mandatory: false },
              ].map((crit, i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                  <div className={`p-2 rounded-lg ${crit.mandatory ? 'bg-amber-500/20' : 'bg-muted'}`}>
                    {crit.mandatory ? (
                      <UserCheck className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Info className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{crit.title}</h4>
                      <Badge variant={crit.mandatory ? 'default' : 'outline'} className="text-xs">
                        {crit.mandatory ? 'Mandatory' : 'Desirable'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{crit.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 14: SUBMISSION INSTRUCTIONS */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-white font-bold">14</span>
              <h2 className="text-2xl font-bold">Submission Instructions</h2>
              {isEditMode && changedFields.has('submissionInstructions') && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Modified</Badge>
              )}
            </div>

            {isEditMode && (
              <div className="mb-6">
                <Label className="text-sm font-medium mb-2 block">Additional Submission Instructions</Label>
                <Textarea
                  value={displaySections?.submissionInstructions || ''}
                  onChange={(e) => handleFieldUpdate('submissionInstructions', e.target.value)}
                  className="min-h-[100px] font-normal text-base"
                  placeholder="Enter additional submission instructions..."
                  data-testid="textarea-submission-instructions"
                />
              </div>
            )}
            {!isEditMode && displaySections?.submissionInstructions && (
              <p className="text-muted-foreground mb-6 whitespace-pre-wrap">{displaySections.submissionInstructions}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-green-500" />
                  11.1 Proposal Format
                </h3>
                <ul className="space-y-3">
                  {[
                    'Submit proposal in two sealed envelopes (Technical & Commercial)',
                    'Technical proposal: Maximum 100 pages excluding annexes',
                    'All documents in PDF format with OCR capability',
                    'Arabic executive summary mandatory',
                    'USB drive with digital copies of all documents',
                    'Proposal valid for minimum 120 days from submission',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Mail className="w-5 h-5 text-green-500" />
                  11.2 Submission Details
                </h3>
                <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">Point of Contact</div>
                      <div className="text-sm text-muted-foreground">{demand?.requestorName || 'Not recorded'}</div>
                      <div className="text-sm text-muted-foreground">{demand?.requestorEmail || 'Not recorded'}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">Deadline</div>
                      <div className="text-sm text-muted-foreground">{submissionDeadline}, 17:00 UAE Time</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">Submission Address</div>
                      <div className="text-sm text-muted-foreground">Procurement Office, {organizationName || 'Not recorded'}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">Clarification Questions</div>
                      <div className="text-sm text-muted-foreground">Submit via email by {new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 15: EVALUATION METHODOLOGY */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-bold">15</span>
              <h2 className="text-2xl font-bold">Evaluation Methodology</h2>
              <Badge className="ml-auto bg-indigo-500">
                {sections.evaluationCriteria?.reduce((sum, c) => sum + c.weight, 0) || 100}% Total
              </Badge>
            </div>

            <p className="text-muted-foreground mb-6">
              Proposals will be evaluated using a weighted scoring methodology. The evaluation committee will assess each proposal against the following criteria.
            </p>

            <div className="space-y-4" data-testid="rfp-evaluation-criteria">
              {sections.evaluationCriteria?.map((criterion, i) => (
                <div key={i} className="p-4 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                        <span className="text-indigo-500 font-bold">{i + 1}</span>
                      </div>
                      <div>
                        <h4 className="font-semibold">{criterion.criterion}</h4>
                        <p className="text-xs text-muted-foreground">{criterion.scoringMethod}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-indigo-500">{criterion.weight}%</div>
                    </div>
                  </div>
                  <Progress value={criterion.weight} className="h-2" />
                </div>
              ))}
              {(!sections.evaluationCriteria || sections.evaluationCriteria.length === 0) && (
                <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-lg">
                  Evaluation criteria will be populated based on project requirements.
                </div>
              )}
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-blue-700 dark:text-blue-400">Scoring Note</h4>
                  <p className="text-sm text-muted-foreground">
                    Technical proposals scoring below 70% will not proceed to commercial evaluation. The final selection will be based on the best value-for-money principle.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 16: TIMELINE & MILESTONES */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center text-white font-bold">16</span>
              <h2 className="text-2xl font-bold">Timeline & Milestones</h2>
              {isEditMode && changedFields.has('projectTimeline') && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Modified</Badge>
              )}
            </div>

            {isEditMode && (
              <div className="mb-6">
                <Label className="text-sm font-medium mb-2 block">Additional Timeline Notes</Label>
                <Textarea
                  value={displaySections?.projectTimeline || ''}
                  onChange={(e) => handleFieldUpdate('projectTimeline', e.target.value)}
                  className="min-h-[100px] font-normal text-base"
                  placeholder="Enter additional timeline notes or adjustments..."
                  data-testid="textarea-project-timeline"
                />
              </div>
            )}
            {!isEditMode && displaySections?.projectTimeline && (
              <p className="text-muted-foreground mb-6 whitespace-pre-wrap">{displaySections.projectTimeline}</p>
            )}

            <div className="space-y-4">
              {[
                { phase: 'RFP Issue Date', date: issueDate, status: 'completed' },
                { phase: 'Clarification Deadline', date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'), status: 'upcoming' },
                { phase: 'Proposal Submission', date: submissionDeadline, status: 'upcoming' },
                { phase: 'Technical Evaluation', date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'), status: 'upcoming' },
                { phase: 'Vendor Presentations', date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'), status: 'upcoming' },
                { phase: 'Contract Award', date: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'), status: 'upcoming' },
                { phase: 'Project Kickoff', date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'), status: 'upcoming' },
              ].map((milestone, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 ${milestone.status === 'completed' ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                  <div className="flex-1 flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                    <span className="font-medium">{milestone.phase}</span>
                    <span className="text-muted-foreground">{milestone.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 17: COMMERCIAL & PRICING */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold">17</span>
              <h2 className="text-2xl font-bold">Commercial & Pricing Requirements</h2>
              {isEditMode && changedFields.has('commercialTerms') && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Modified</Badge>
              )}
            </div>

            {isEditMode ? (
              <Textarea
                value={displaySections?.commercialTerms || 'Vendors must provide detailed pricing in a separate sealed commercial envelope. All prices must be quoted in UAE Dirhams (AED) inclusive of all applicable taxes.'}
                onChange={(e) => handleFieldUpdate('commercialTerms', e.target.value)}
                className="min-h-[120px] font-normal text-base mb-6"
                placeholder="Enter commercial and pricing requirements..."
                data-testid="textarea-commercial-terms"
              />
            ) : (
              <p className="text-muted-foreground mb-6">
                {displaySections?.commercialTerms || 'Vendors must provide detailed pricing in a separate sealed commercial envelope. All prices must be quoted in UAE Dirhams (AED) inclusive of all applicable taxes.'}
              </p>
            )}

            <div className="space-y-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-500" />
                14.1 Pricing Structure
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cost Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Pricing Basis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { cat: 'License Fees', desc: 'Software licensing costs (perpetual or subscription)', basis: 'Per user / Per module' },
                    { cat: 'Implementation', desc: 'Design, configuration, development, testing', basis: 'Fixed price or T&M' },
                    { cat: 'Integration', desc: 'Third-party system integration costs', basis: 'Per integration' },
                    { cat: 'Training', desc: 'User and administrator training', basis: 'Per session / Per trainee' },
                    { cat: 'Support & Maintenance', desc: 'Annual support and maintenance fees', basis: 'Annual subscription' },
                    { cat: 'Infrastructure', desc: 'Hosting and cloud infrastructure (if applicable)', basis: 'Monthly / Annual' },
                  ].map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.cat}</TableCell>
                      <TableCell className="text-muted-foreground">{row.desc}</TableCell>
                      <TableCell><Badge variant="outline">{row.basis}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 18: TERMS & CONDITIONS */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-slate-500 flex items-center justify-center text-white font-bold">18</span>
              <h2 className="text-2xl font-bold">Terms & Conditions</h2>
              {isEditMode && changedFields.has('additionalTerms') && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Modified</Badge>
              )}
              <Badge variant="outline" className="ml-auto">{sections.termsAndConditions?.length || 0} Clauses</Badge>
            </div>

            {isEditMode ? (
              <Textarea
                value={displaySections?.additionalTerms || 'The following terms and conditions shall govern this procurement and the resulting contract. All vendors must accept these terms in their entirety.'}
                onChange={(e) => handleFieldUpdate('additionalTerms', e.target.value)}
                className="min-h-[120px] font-normal text-base mb-6"
                placeholder="Enter additional terms and conditions..."
                data-testid="textarea-additional-terms"
              />
            ) : (
              <p className="text-muted-foreground mb-6">
                {displaySections?.additionalTerms || 'The following terms and conditions shall govern this procurement and the resulting contract. All vendors must accept these terms in their entirety.'}
              </p>
            )}

            <div className="space-y-3" data-testid="rfp-terms-conditions">
              {sections.termsAndConditions?.map((term, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-slate-500/20 flex items-center justify-center text-slate-500 font-bold text-sm flex-shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-sm leading-relaxed">{term}</p>
                </div>
              ))}
              {(!sections.termsAndConditions || sections.termsAndConditions.length === 0) && (
                <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-lg">
                  Standard government procurement terms will be applied.
                </div>
              )}
            </div>
          </section>

          <Separator className="my-8" />

          {/* SECTION 18.1: COMPLIANCE STATUS */}
          {sections.complianceChecks && sections.complianceChecks.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <span className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <h2 className="text-2xl font-bold">18.1 UAE Regulatory Compliance</h2>
                <Badge className="ml-auto bg-emerald-500">{compliancePercentage}% Compliant</Badge>
              </div>

              <p className="text-muted-foreground mb-6">
                This RFP has been validated against UAE federal procurement regulations and compliance requirements.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sections.complianceChecks.map((check, i) => (
                  <div 
                    key={i} 
                    className={`p-4 rounded-lg border ${
                      check.status === 'pass' 
                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                        : check.status === 'warning'
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                    data-testid={`compliance-check-${i}`}
                  >
                    <div className="flex items-start gap-3">
                      {check.status === 'pass' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      ) : check.status === 'warning' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-medium">{check.regulation}</div>
                        <div className="text-xs text-muted-foreground mt-1">{check.notes}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* DOCUMENT FOOTER */}
          <div className="mt-12 pt-8 border-t border-border/50">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                <p className="font-medium">{organizationName || 'Not recorded'}</p>
                <p>Generated on {new Date(tender.generatedAt).toLocaleDateString('en-GB', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
              </div>
              <div className="text-right">
                <p className="font-mono">{referenceNumber}</p>
                <div className="flex items-center gap-2 justify-end mt-1">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>AI-Generated Document</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default RfpDocumentTab;
