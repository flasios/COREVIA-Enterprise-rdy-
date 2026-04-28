import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Users, Upload, Play, Trophy, AlertCircle, CheckCircle2, 
  FileText, Trash2, Building2, Mail, Phone, Plus, Star,
  BarChart3, FileSearch, Loader2, ChevronDown, ChevronUp, Scale
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table as _Table,
  TableBody as _TableBody,
  TableCell as _TableCell,
  TableHead as _TableHead,
  TableHeader as _TableHeader,
  TableRow as _TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useDropzone } from 'react-dropzone';

interface VendorEvaluationTabProps {
  demandReportId: string;
}

interface Vendor {
  id: string;
  demandReportId: string;
  vendorName: string;
  vendorCode?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  status: string;
  invitedAt?: Date;
  submittedAt?: Date;
  createdAt: Date;
}

interface Proposal {
  id: string;
  vendorId: string;
  demandReportId: string;
  proposalTitle?: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  status: string;
  extractedText?: string;
  proposalSummary?: string;
  uploadedAt: Date;
  processedAt?: Date;
}

interface EvaluationCriterion {
  id: string;
  criterionName: string;
  description?: string;
  weight: number;
  category?: string;
  isDefault: boolean;
}

interface VendorRanking {
  rank: number;
  vendorId: string;
  vendorName: string;
  proposalId: string;
  totalScore: number;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  recommendation: string;
}

interface EvaluationResult {
  id: string;
  demandReportId: string;
  status: string;
  totalVendors: number;
  evaluatedVendors: number;
  aiSummary?: string;
  vendorRankings?: VendorRanking[];
  comparisonMatrix?: VendorRanking[];
  qualityScore?: number;
  confidenceScore?: number;
  evaluatedAt?: Date;
}

export function VendorEvaluationTab({ demandReportId }: VendorEvaluationTabProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [selectedVendorForUpload, setSelectedVendorForUpload] = useState<Vendor | null>(null);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [newVendor, setNewVendor] = useState({
    vendorName: '',
    vendorCode: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  const { data: vendorsData, isLoading: loadingVendors } = useQuery<{ success: boolean; data: Vendor[] }>({
    queryKey: ['/api/tenders/vendors', demandReportId],
  });
  const vendors = vendorsData?.data || [];

  const { data: proposalsData, isLoading: loadingProposals } = useQuery<{ success: boolean; data: Proposal[] }>({
    queryKey: ['/api/tenders/proposals', demandReportId],
  });
  const proposals = proposalsData?.data || [];

  const { data: criteriaData, isLoading: loadingCriteria } = useQuery<{ success: boolean; data: EvaluationCriterion[] }>({
    queryKey: ['/api/tenders/criteria', demandReportId],
  });
  const criteria = criteriaData?.data || [];

  const { data: evaluationData, isLoading: _loadingEvaluation } = useQuery<{ success: boolean; data: EvaluationResult | null }>({
    queryKey: ['/api/tenders/evaluation', demandReportId],
  });
  const evaluation = evaluationData?.data;

  const addVendorMutation = useMutation({
    mutationFn: async (vendorData: typeof newVendor & { demandReportId: string }) => {
      return await apiRequest('POST', '/api/tenders/vendors', vendorData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenders/vendors', demandReportId] });
      setIsAddVendorOpen(false);
      setNewVendor({ vendorName: '', vendorCode: '', contactName: '', contactEmail: '', contactPhone: '' });
      toast({ title: t('projectWorkspace.toast.vendorAdded'), description: t('projectWorkspace.toast.vendorAddedDesc') });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({ title: t('projectWorkspace.toast.error'), description: error.message || t('projectWorkspace.toast.failedAddVendor'), variant: 'destructive' });
    },
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      return await apiRequest('DELETE', `/api/tenders/vendors/${vendorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenders/vendors', demandReportId] });
      toast({ title: t('projectWorkspace.toast.vendorRemoved'), description: t('projectWorkspace.toast.vendorRemovedDesc') });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({ title: t('projectWorkspace.toast.error'), description: error.message || t('projectWorkspace.toast.failedRemoveVendor'), variant: 'destructive' });
    },
  });

  const uploadProposalMutation = useMutation({
    mutationFn: async ({ vendorId, file }: { vendorId: string; file: File }) => {
      const proposalData = {
        vendorId,
        demandReportId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        proposalTitle: file.name.replace(/\.[^/.]+$/, ''),
        status: 'pending',
      };
      return await apiRequest('POST', '/api/tenders/proposals', proposalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenders/proposals', demandReportId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tenders/vendors', demandReportId] });
      setSelectedVendorForUpload(null);
      toast({ title: t('projectWorkspace.toast.proposalRegistered'), description: t('projectWorkspace.toast.proposalRegisteredDesc') });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({ title: t('projectWorkspace.toast.registrationFailed'), description: error.message || t('projectWorkspace.toast.failedRegisterProposal'), variant: 'destructive' });
    },
  });

  const processProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return await apiRequest('PATCH', `/api/tenders/proposals/${proposalId}`, { 
        status: 'processed', 
        processedAt: new Date().toISOString() 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenders/proposals', demandReportId] });
      toast({ title: t('projectWorkspace.toast.proposalProcessed'), description: t('projectWorkspace.toast.proposalProcessedDesc') });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({ title: t('projectWorkspace.toast.processingFailed'), description: error.message || t('projectWorkspace.toast.failedProcessProposal'), variant: 'destructive' });
    },
  });

  const runEvaluationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/tenders/evaluation', { 
        demandReportId,
        status: 'completed',
        totalVendors: vendors.length,
        evaluatedVendors: proposals.length,
        evaluatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenders/evaluation', demandReportId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tenders/vendors', demandReportId] });
      toast({ title: t('projectWorkspace.toast.evaluationComplete'), description: t('projectWorkspace.toast.evaluationCompleteDesc') });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({ title: t('projectWorkspace.toast.evaluationFailed'), description: error.message || t('projectWorkspace.toast.failedRunEvaluation'), variant: 'destructive' });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (selectedVendorForUpload && acceptedFiles.length > 0) {
      uploadProposalMutation.mutate({ vendorId: selectedVendorForUpload.id, file: acceptedFiles[0]! });
    }
  }, [selectedVendorForUpload, uploadProposalMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const getVendorProposal = (vendorId: string) => {
    return proposals.find(p => p.vendorId === vendorId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'invited':
      case 'registered':
        return <Badge variant="outline" className="text-blue-600 border-blue-300">Registered</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="text-amber-600 border-amber-300">Proposal Uploaded</Badge>;
      case 'evaluated':
        return <Badge className="bg-emerald-600">Evaluated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const processedProposalsCount = proposals.filter(p => p.extractedText).length;
  const canRunEvaluation = processedProposalsCount > 0;

  if (loadingVendors || loadingProposals || loadingCriteria) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-lg font-bold">{vendors.length}</div>
                <div className="text-sm text-muted-foreground">Vendors</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-lg font-bold">{proposals.length}</div>
                <div className="text-sm text-muted-foreground">Proposals</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-lg font-bold">{processedProposalsCount}</div>
                <div className="text-sm text-muted-foreground">Processed</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Scale className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-lg font-bold">{criteria.length}</div>
                <div className="text-sm text-muted-foreground">Criteria</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card/60">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Vendor Proposals
                </CardTitle>
                <CardDescription>
                  Register vendors and upload their technical proposals for AI evaluation
                </CardDescription>
              </div>
              <Dialog open={isAddVendorOpen} onOpenChange={setIsAddVendorOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-vendor">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Vendor
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Register Vendor</DialogTitle>
                    <DialogDescription>
                      Register a vendor whose proposal you want to evaluate.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Vendor Name *</Label>
                      <Input
                        value={newVendor.vendorName}
                        onChange={(e) => setNewVendor({ ...newVendor, vendorName: e.target.value })}
                        placeholder={t('projectWorkspace.vendor.companyName')}
                        data-testid="input-vendor-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Vendor Code</Label>
                      <Input
                        value={newVendor.vendorCode}
                        onChange={(e) => setNewVendor({ ...newVendor, vendorCode: e.target.value })}
                        placeholder={t('projectWorkspace.vendor.optionalIdentifier')}
                        data-testid="input-vendor-code"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Name</Label>
                      <Input
                        value={newVendor.contactName}
                        onChange={(e) => setNewVendor({ ...newVendor, contactName: e.target.value })}
                        placeholder={t('projectWorkspace.vendor.primaryContact')}
                        data-testid="input-contact-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Email</Label>
                      <Input
                        type="email"
                        value={newVendor.contactEmail}
                        onChange={(e) => setNewVendor({ ...newVendor, contactEmail: e.target.value })}
                        placeholder={t('projectWorkspace.vendor.emailPlaceholder')}
                        data-testid="input-contact-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Phone</Label>
                      <Input
                        value={newVendor.contactPhone}
                        onChange={(e) => setNewVendor({ ...newVendor, contactPhone: e.target.value })}
                        placeholder="+971 XX XXX XXXX"
                        data-testid="input-contact-phone"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button
                      onClick={() => addVendorMutation.mutate({ ...newVendor, demandReportId })}
                      disabled={!newVendor.vendorName || addVendorMutation.isPending}
                      data-testid="button-submit-vendor"
                    >
                      {addVendorMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Add Vendor
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {vendors.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">{t('projectWorkspace.vendor.noVendors')}</p>
                  <p className="text-sm text-muted-foreground">Register vendors and upload their proposals for evaluation.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vendors.map((vendor) => {
                    const proposal = getVendorProposal(vendor.id);
                    const isExpanded = expandedVendor === vendor.id;
                    
                    return (
                      <Collapsible
                        key={vendor.id}
                        open={isExpanded}
                        onOpenChange={(open) => setExpandedVendor(open ? vendor.id : null)}
                      >
                        <div className="border rounded-lg">
                          <CollapsibleTrigger className="w-full" asChild>
                            <div className="p-4 cursor-pointer hover-elevate">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-muted">
                                    <Building2 className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="font-medium">{vendor.vendorName}</div>
                                    {vendor.vendorCode && (
                                      <div className="text-xs text-muted-foreground">{vendor.vendorCode}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getStatusBadge(vendor.status)}
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <Separator />
                            <div className="p-4 space-y-4 bg-muted/30">
                              {vendor.contactName && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                                  <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-muted-foreground" />
                                    <span>{vendor.contactName}</span>
                                  </div>
                                  {vendor.contactEmail && (
                                    <div className="flex items-center gap-2">
                                      <Mail className="w-4 h-4 text-muted-foreground" />
                                      <span>{vendor.contactEmail}</span>
                                    </div>
                                  )}
                                  {vendor.contactPhone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="w-4 h-4 text-muted-foreground" />
                                      <span>{vendor.contactPhone}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {proposal ? (
                                <div className="p-3 rounded-lg border bg-card">
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                      <FileText className="w-5 h-5 text-amber-600" />
                                      <div>
                                        <div className="font-medium text-sm">{proposal.fileName}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {proposal.fileSize ? `${(proposal.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {proposal.status === 'uploaded' && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => processProposalMutation.mutate(proposal.id)}
                                          disabled={processProposalMutation.isPending}
                                          data-testid={`button-process-proposal-${vendor.id}`}
                                        >
                                          {processProposalMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                          ) : (
                                            <FileSearch className="w-4 h-4 mr-2" />
                                          )}
                                          Process
                                        </Button>
                                      )}
                                      {proposal.status === 'evaluated' && (
                                        <Badge className="bg-emerald-600">
                                          <CheckCircle2 className="w-3 h-3 mr-1" />
                                          Analyzed
                                        </Badge>
                                      )}
                                      {proposal.status === 'processing' && (
                                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          Processing
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  {proposal.proposalSummary && (
                                    <div className="mt-3 pt-3 border-t">
                                      <div className="text-xs font-medium text-muted-foreground mb-1">AI Summary</div>
                                      <p className="text-sm text-muted-foreground line-clamp-3">
                                        {proposal.proposalSummary}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => setSelectedVendorForUpload(vendor)}
                                  data-testid={`button-upload-proposal-${vendor.id}`}
                                >
                                  <Upload className="w-4 h-4 mr-2" />
                                  Upload Technical Proposal
                                </Button>
                              )}

                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => deleteVendorMutation.mutate(vendor.id)}
                                  disabled={deleteVendorMutation.isPending}
                                  data-testid={`button-delete-vendor-${vendor.id}`}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {evaluation?.status === 'completed' && evaluation.vendorRankings && (
            <Card className="bg-card/60 border-2 border-emerald-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Evaluation Results
                </CardTitle>
                <CardDescription>
                  AI-powered vendor rankings based on {criteria.length} evaluation criteria
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {evaluation.vendorRankings.map((ranking: VendorRanking) => (
                    <div
                      key={ranking.vendorId}
                      className={`p-4 rounded-lg border ${
                        ranking.rank === 1 
                          ? 'bg-amber-500/10 border-amber-500/30' 
                          : 'bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            ranking.rank === 1 
                              ? 'bg-amber-500 text-white' 
                              : ranking.rank === 2
                              ? 'bg-gray-400 text-white'
                              : ranking.rank === 3
                              ? 'bg-amber-700 text-white'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {ranking.rank}
                          </div>
                          <div>
                            <div className="font-medium">{ranking.vendorName}</div>
                            {ranking.rank === 1 && (
                              <Badge className="bg-amber-500">
                                <Star className="w-3 h-3 mr-1" />
                                Recommended
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{ranking.totalScore.toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">out of 100</div>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <Progress value={ranking.totalScore} className="h-2" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-xs font-medium text-emerald-600 mb-1">Strengths</div>
                          <ul className="space-y-1">
                            {ranking.strengths.slice(0, 3).map((s: string, i: number) => (
                              <li key={i} className="flex items-start gap-1 text-muted-foreground">
                                <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-500 shrink-0" />
                                <span className="line-clamp-1">{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-amber-600 mb-1">Areas for Improvement</div>
                          <ul className="space-y-1">
                            {ranking.weaknesses.slice(0, 3).map((w: string, i: number) => (
                              <li key={i} className="flex items-start gap-1 text-muted-foreground">
                                <AlertCircle className="w-3 h-3 mt-0.5 text-amber-500 shrink-0" />
                                <span className="line-clamp-1">{w}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {evaluation.aiSummary && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm font-medium mb-2">Executive Summary</div>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {evaluation.aiSummary}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Evaluation Criteria
              </CardTitle>
              <CardDescription>
                Weighted criteria used for AI evaluation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {criteria.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.criterionName}</div>
                      {c.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{c.description}</div>
                      )}
                    </div>
                    <Badge variant="outline">{c.weight}%</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={`border-2 ${canRunEvaluation ? 'border-primary/30' : 'border-border'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Run AI Evaluation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {canRunEvaluation ? (
                  <>
                    {processedProposalsCount} proposal{processedProposalsCount > 1 ? 's' : ''} ready for evaluation.
                    The AI will analyze each proposal against {criteria.length} criteria and generate rankings.
                  </>
                ) : (
                  <>
                    Upload and process at least one vendor proposal before running the evaluation.
                  </>
                )}
              </div>
              
              <Button
                className="w-full"
                disabled={!canRunEvaluation || runEvaluationMutation.isPending}
                onClick={() => runEvaluationMutation.mutate()}
                data-testid="button-run-evaluation"
              >
                {runEvaluationMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run AI Evaluation
                  </>
                )}
              </Button>

              {evaluation?.status === 'completed' && (
                <div className="p-3 rounded-lg bg-emerald-500/10 text-sm">
                  <div className="flex items-center gap-2 text-emerald-600 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Evaluation Completed
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {evaluation.evaluatedVendors} of {evaluation.totalVendors} vendors evaluated
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedVendorForUpload} onOpenChange={() => setSelectedVendorForUpload(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Technical Proposal</DialogTitle>
            <DialogDescription>
              Upload the technical proposal from {selectedVendorForUpload?.vendorName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors
                ${isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              <input {...getInputProps()} data-testid="input-proposal-file" />
              <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-primary font-medium">Drop the file here...</p>
              ) : (
                <>
                  <p className="font-medium mb-1">
                    Drag & drop a proposal file here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to select (PDF, DOCX up to 50MB)
                  </p>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedVendorForUpload(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
