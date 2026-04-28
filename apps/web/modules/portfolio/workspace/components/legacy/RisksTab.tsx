import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  AlertTriangle,
  Layers,
  BarChart3,
  Plus,
  Search,
  TrendingUp,
  Target,
  Users,
  Shield,
  FileText,
  Edit3,
  Trash2,
  Loader2,
  CheckCircle2,
  Eye,
  ShieldCheck,
  XCircle,
  Link2,
} from 'lucide-react';

import type { RiskData } from '../../types';
import { riskLevelColors, statusColors } from '../../utils';

interface RisksTabProps {
  risks: RiskData[];
  onAddRisk: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  projectId: string;
}

interface CriticalPathTaskRef {
  taskCode: string;
  title?: string;
  isCritical?: boolean;
}

export function RisksTab({
  risks,
  onAddRisk,
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  projectId,
}: RisksTabProps) {
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
  const [editingRisk, setEditingRisk] = useState<RiskData | null>(null);
  const [deletingRisk, setDeletingRisk] = useState<RiskData | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();

  const filteredRisks = risks.filter(risk => {
    const matchesSearch = risk.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      risk.riskCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || risk.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const probabilityLevels = ['Very High', 'High', 'Medium', 'Low', 'Very Low'];
  const impactLevels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];

  const getRiskMatrixCell = (probability: string, impact: string) => {
    return risks.filter(r =>
      r.probability?.toLowerCase() === probability.toLowerCase() &&
      r.impact?.toLowerCase() === impact.toLowerCase()
    );
  };

  const getMatrixCellColor = (prob: number, imp: number) => {
    const score = (prob + 1) * (imp + 1);
    if (score >= 20) return 'bg-red-900/40 border-red-700/50';
    if (score >= 12) return 'bg-orange-900/40 border-orange-700/50';
    if (score >= 6) return 'bg-amber-900/40 border-amber-700/50';
    return 'bg-emerald-900/40 border-emerald-700/50';
  };

  const riskStats = {
    total: risks.length,
    critical: risks.filter(r => r.riskLevel === 'critical').length,
    high: risks.filter(r => r.riskLevel === 'high').length,
    medium: risks.filter(r => r.riskLevel === 'medium').length,
    low: risks.filter(r => r.riskLevel === 'low').length,
    mitigating: risks.filter(r => r.status === 'mitigating').length,
  };

  const updateRiskMutation = useMutation({
    mutationFn: async (data: { id: string; updates: unknown }) => {
      const response = await apiRequest('PATCH', `/api/portfolio/risks/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('projectWorkspace.toast.riskUpdated'), description: t('projectWorkspace.toast.riskUpdatedDesc') });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId] });
      setEditingRisk(null);
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.updateFailed'), description: t('projectWorkspace.toast.failedUpdateRisk'), variant: "destructive" });
    },
  });

  const deleteRiskMutation = useMutation({
    mutationFn: async (riskId: string) => {
      const response = await apiRequest('DELETE', `/api/portfolio/risks/${riskId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('projectWorkspace.toast.riskDeleted'), description: t('projectWorkspace.toast.riskRemovedFromRegisterDesc') });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId] });
      setDeletingRisk(null);
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.deleteFailed'), description: t('projectWorkspace.toast.failedDeleteRisk'), variant: "destructive" });
    },
  });

  const quickStatusChange = (riskId: string, newStatus: string) => {
    updateRiskMutation.mutate({ id: riskId, updates: { status: newStatus } });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-6 gap-3">
        <Card className="bg-card/60 border-border p-3">
          <div className="text-xl font-bold text-foreground">{riskStats.total}</div>
          <div className="text-xs text-muted-foreground">Total Risks</div>
        </Card>
        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30 p-3">
          <div className="text-xl font-bold text-red-600 dark:text-red-400">{riskStats.critical}</div>
          <div className="text-xs text-muted-foreground">Critical</div>
        </Card>
        <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/30 p-3">
          <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{riskStats.high}</div>
          <div className="text-xs text-muted-foreground">High</div>
        </Card>
        <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30 p-3">
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{riskStats.medium}</div>
          <div className="text-xs text-muted-foreground">Medium</div>
        </Card>
        <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30 p-3">
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{riskStats.low}</div>
          <div className="text-xs text-muted-foreground">Low</div>
        </Card>
        <Card className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/30 p-3">
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{riskStats.mitigating}</div>
          <div className="text-xs text-muted-foreground">Mitigating</div>
        </Card>
      </div>

      <Card className="bg-card/60 border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Risk Register</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Track, assess, and mitigate project risks</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-border/50 rounded-md overflow-visible">
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                className="rounded-none gap-1"
                onClick={() => setViewMode('list')}
                data-testid="button-view-list"
              >
                <Layers className="w-3 h-3" />
                List
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'matrix' ? 'default' : 'ghost'}
                className="rounded-none gap-1"
                onClick={() => setViewMode('matrix')}
                data-testid="button-view-matrix"
              >
                <BarChart3 className="w-3 h-3" />
                Matrix
              </Button>
            </div>
            {viewMode === 'list' && (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search risks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-48 bg-muted/50 border-border/50"
                    data-testid="input-search-risks"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32 bg-muted/50 border-border/50" data-testid="select-filter-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="identified">Identified</SelectItem>
                    <SelectItem value="analyzing">Analyzing</SelectItem>
                    <SelectItem value="mitigating">Mitigating</SelectItem>
                    <SelectItem value="monitoring">Monitoring</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
            <Button size="sm" className="gap-2" onClick={onAddRisk} data-testid="button-add-risk">
              <Plus className="w-4 h-4" />
              Add Risk
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'matrix' ? (
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                <div className="flex items-end mb-2">
                  <div className="w-24 text-xs text-muted-foreground text-right pr-2 pb-1">Probability</div>
                  <div className="flex-1 text-center text-xs text-muted-foreground">Impact</div>
                </div>
                <div className="flex">
                  <div className="w-24 flex flex-col justify-around pr-2">
                    {probabilityLevels.map(level => (
                      <div key={level} className="text-xs text-muted-foreground text-right h-16 flex items-center justify-end">
                        {level}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 grid grid-cols-5 gap-1">
                    {probabilityLevels.map((prob, probIdx) =>
                      impactLevels.map((imp, impIdx) => {
                        const cellRisks = getRiskMatrixCell(prob, imp);
                        const invertedProbIdx = 4 - probIdx;
                        return (
                          <div
                            key={`${prob}-${imp}`}
                            className={`h-16 rounded-md border ${getMatrixCellColor(invertedProbIdx, impIdx)} 
                              flex flex-col items-center justify-center transition-all hover:scale-105 cursor-pointer`}
                            title={`${prob} probability, ${imp} impact: ${cellRisks.length} risk(s)`}
                          >
                            {cellRisks.length > 0 && (
                              <>
                                <div className="text-lg font-bold text-foreground">{cellRisks.length}</div>
                                <div className="text-[10px] text-muted-foreground">risk{cellRisks.length > 1 ? 's' : ''}</div>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="flex mt-2">
                  <div className="w-24" />
                  <div className="flex-1 grid grid-cols-5 gap-1">
                    {impactLevels.map(level => (
                      <div key={level} className="text-center text-xs text-muted-foreground">{level}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredRisks.map((risk) => {
                  const isClosed = risk.status === 'closed';
                  const _isMitigating = risk.status === 'mitigating';

                  return (
                    <div
                      key={risk.id}
                      className={`p-4 bg-muted/40 border rounded-lg hover-elevate ${
                        isClosed ? 'border-emerald-500/30 opacity-75' :
                        risk.riskLevel === 'critical' ? 'border-red-500/40' :
                        risk.riskLevel === 'high' ? 'border-orange-500/40' :
                        'border-border/50'
                      }`}
                      data-testid={`risk-${risk.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={riskLevelColors[risk.riskLevel] || ''}>
                              {risk.riskLevel}
                            </Badge>
                            <span className="text-xs text-muted-foreground/70 font-mono">{risk.riskCode}</span>
                            {risk.category && (
                              <Badge variant="outline" className="text-xs capitalize">{risk.category}</Badge>
                            )}
                          </div>
                          <h4 className="font-medium mt-2">{risk.title}</h4>
                          {risk.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{risk.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Probability: {risk.probability}
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              Impact: {risk.impact}
                            </span>
                            <span className="flex items-center gap-1 font-medium text-foreground/80">
                              Score: {risk.riskScore}
                            </span>
                          </div>
                          {risk.riskOwner && (
                            <div className="flex items-center gap-2 mt-2 text-xs">
                              <Users className="w-3 h-3 text-muted-foreground" />
                              <span className="text-foreground/80">Owner: {risk.riskOwner}</span>
                            </div>
                          )}
                          {risk.mitigationPlan && (
                            <div className="mt-3 p-3 bg-card/50 rounded border border-border/50">
                              <div className="flex items-center gap-2 mb-1">
                                <Shield className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Mitigation Plan</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{risk.mitigationPlan}</p>
                            </div>
                          )}
                          {risk.contingencyPlan && (
                            <div className="mt-2 p-3 bg-card/50 rounded border border-border/50">
                              <div className="flex items-center gap-2 mb-1">
                                <FileText className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Contingency Plan</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{risk.contingencyPlan}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={statusColors[risk.status] || ''}>
                            {risk.status}
                          </Badge>
                          {risk.reviewDate && (
                            <span className="text-xs text-muted-foreground/70">
                              Review: {new Date(risk.reviewDate).toLocaleDateString()}
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setEditingRisk(risk)}
                              data-testid={`button-edit-risk-${risk.id}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500 hover:text-red-600"
                              onClick={() => setDeletingRisk(risk)}
                              data-testid={`button-delete-risk-${risk.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {!isClosed && (
                        <div className="mt-3 flex items-center gap-2 flex-wrap border-t border-border/30 pt-3">
                          <span className="text-xs text-muted-foreground mr-2">Quick Actions:</span>
                          {risk.status !== 'analyzing' && risk.status !== 'mitigating' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs gap-1"
                              onClick={() => quickStatusChange(risk.id, 'analyzing')}
                              disabled={updateRiskMutation.isPending}
                            >
                              <Eye className="w-3 h-3" />
                              Analyze
                            </Button>
                          )}
                          {risk.status !== 'mitigating' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs gap-1 text-indigo-600"
                              onClick={() => quickStatusChange(risk.id, 'mitigating')}
                              disabled={updateRiskMutation.isPending}
                            >
                              <Shield className="w-3 h-3" />
                              Start Mitigation
                            </Button>
                          )}
                          {risk.status !== 'monitoring' && risk.status !== 'closed' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs gap-1 text-blue-600"
                              onClick={() => quickStatusChange(risk.id, 'monitoring')}
                              disabled={updateRiskMutation.isPending}
                            >
                              <ShieldCheck className="w-3 h-3" />
                              Monitor
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs gap-1 text-emerald-600"
                            onClick={() => quickStatusChange(risk.id, 'closed')}
                            disabled={updateRiskMutation.isPending}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Close
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!filteredRisks.length && (
                  <div className="text-center text-muted-foreground/70 py-12">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No risks found. Add risks to track potential issues proactively.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-4"
                      onClick={onAddRisk}
                      data-testid="button-add-first-risk"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Risk
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingRisk} onOpenChange={(open) => !open && setEditingRisk(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-500" />
              Edit Risk
            </DialogTitle>
            <DialogDescription>
              Update risk details, assessment, and mitigation plans
            </DialogDescription>
          </DialogHeader>
          {editingRisk && (
            <RiskEditForm
              risk={editingRisk}
              onSave={(updates) => updateRiskMutation.mutate({ id: editingRisk.id, updates })}
              onCancel={() => setEditingRisk(null)}
              isLoading={updateRiskMutation.isPending}
              projectId={projectId}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRisk} onOpenChange={(open) => !open && setDeletingRisk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Risk
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingRisk?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRisk && deleteRiskMutation.mutate(deletingRisk.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteRiskMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RiskEditForm({ risk, onSave, onCancel, isLoading, projectId }: {
  risk: RiskData;
  onSave: (updates: unknown) => void;
  onCancel: () => void;
  isLoading: boolean;
  projectId: string;
}) {
  const [title, setTitle] = useState(risk.title);
  const [description, setDescription] = useState(risk.description || '');
  const [status, setStatus] = useState(risk.status);
  const [riskLevel, setRiskLevel] = useState(risk.riskLevel);
  const [category, setCategory] = useState(risk.category || 'operational');
  const [probability, setProbability] = useState(risk.probability || 'Medium');
  const [impact, setImpact] = useState(risk.impact || 'Medium');
  const [riskOwner, setRiskOwner] = useState(risk.riskOwner || '');
  const [mitigationPlan, setMitigationPlan] = useState(risk.mitigationPlan || '');
  const [contingencyPlan, setContingencyPlan] = useState(risk.contingencyPlan || '');
  const [linkedTasks, setLinkedTasks] = useState<string[]>((risk as any).linkedTasks || []); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [showTaskPicker, setShowTaskPicker] = useState(false);

  // Fetch management summary for critical path tasks
  const { data: managementData } = useQuery<{ success: boolean; data?: { tasks: CriticalPathTaskRef[] } }>({
    queryKey: ['/api/portfolio/projects', projectId, 'management-summary'],
    enabled: showTaskPicker, // Only fetch when task picker is opened
  });

  // Get critical path tasks from management summary - filter for isCritical flag
  const criticalTasks = managementData?.data?.tasks?.filter((t) => t.isCritical) || [];

  const handleSave = () => {
    onSave({
      title,
      description,
      status,
      riskLevel,
      category,
      probability,
      impact,
      riskOwner: riskOwner || null,
      mitigationPlan: mitigationPlan || null,
      contingencyPlan: contingencyPlan || null,
      linkedTasks,
    });
  };

  const toggleTaskLink = (taskId: string) => {
    setLinkedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">{risk.riskCode}</Badge>
          <Badge variant="outline" className={riskLevelColors[risk.riskLevel] || ''}>{risk.riskLevel}</Badge>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="identified">Identified</SelectItem>
              <SelectItem value="analyzing">Analyzing</SelectItem>
              <SelectItem value="mitigating">Mitigating</SelectItem>
              <SelectItem value="monitoring">Monitoring</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Risk Level</Label>
          <Select value={riskLevel} onValueChange={setRiskLevel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Probability</Label>
          <Select value={probability} onValueChange={setProbability}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Very High">Very High</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Very Low">Very Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Impact</Label>
          <Select value={impact} onValueChange={setImpact}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Very High">Very High</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Very Low">Very Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
              <SelectItem value="financial">Financial</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="regulatory">Regulatory</SelectItem>
              <SelectItem value="schedule">Schedule</SelectItem>
              <SelectItem value="resource">Resource</SelectItem>
              <SelectItem value="external">External</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Risk Owner</Label>
          <Input value={riskOwner} onChange={(e) => setRiskOwner(e.target.value)} placeholder="Enter owner name" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Mitigation Plan</Label>
        <Textarea
          value={mitigationPlan}
          onChange={(e) => setMitigationPlan(e.target.value)}
          placeholder="Describe actions to reduce the risk..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Contingency Plan</Label>
        <Textarea
          value={contingencyPlan}
          onChange={(e) => setContingencyPlan(e.target.value)}
          placeholder="Describe actions if the risk materializes..."
          rows={2}
        />
      </div>

      {/* Linked Critical Path Tasks */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Linked Critical Path Tasks
          </Label>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowTaskPicker(!showTaskPicker)}
            data-testid="button-toggle-task-picker"
          >
            {showTaskPicker ? 'Hide Tasks' : 'Select Tasks'}
          </Button>
        </div>
        
        {/* Currently linked tasks display */}
        {linkedTasks.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {linkedTasks.map(taskId => {
              const task = criticalTasks.find((t) => t.taskCode === taskId);
              return (
                <Badge 
                  key={taskId} 
                  variant="outline"
                  className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                >
                  {taskId} {task ? `- ${(task.title ?? '').slice(0, 30)}...` : ''}
                  <button
                    onClick={() => toggleTaskLink(taskId)}
                    className="ml-1 hover:text-red-800"
                    data-testid={`button-unlink-task-${taskId}`}
                  >
                    <XCircle className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
        
        {/* Task picker */}
        {showTaskPicker && (
          <div className="border rounded-lg p-3 bg-muted/30 max-h-48 overflow-y-auto">
            {criticalTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No critical path tasks available. Generate WBS tasks first.
              </p>
            ) : (
              <div className="space-y-1">
                {criticalTasks.slice(0, 20).map((task) => (
                  <div 
                    key={task.taskCode}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleTaskLink(task.taskCode)}
                  >
                    <Checkbox 
                      checked={linkedTasks.includes(task.taskCode)}
                      data-testid={`checkbox-link-task-${task.taskCode}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono bg-red-500/10 text-red-600 border-red-500/30">
                          {task.taskCode}
                        </Badge>
                        <span className="text-sm truncate">{task.title}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
