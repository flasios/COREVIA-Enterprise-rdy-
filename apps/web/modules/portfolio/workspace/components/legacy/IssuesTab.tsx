import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Bug,
  Plus,
  Search,
  AlertTriangle,
  Users,
  CalendarDays,
  Clock,
  CheckCircle2,
  Link as LinkIcon,
  ArrowUp,
  Edit3,
  Trash2,
  Loader2,
  Play,
  XCircle as _XCircle,
  ArrowUpCircle,
} from 'lucide-react';

import type { IssueData, RiskData } from '../../types';
import { priorityColors, statusColors, riskLevelColors } from '../../utils';

interface IssuesTabProps {
  issues: IssueData[];
  onAddIssue: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  risks?: RiskData[];
  projectId: string;
}

export function IssuesTab({
  issues,
  onAddIssue,
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  risks,
  projectId,
}: IssuesTabProps) {
  const [editingIssue, setEditingIssue] = useState<IssueData | null>(null);
  const [deletingIssue, setDeletingIssue] = useState<IssueData | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.issueCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || issue.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const issueStats = {
    total: issues.length,
    open: issues.filter(i => i.status === 'open').length,
    inProgress: issues.filter(i => i.status === 'in_progress').length,
    escalated: issues.filter(i => i.status === 'escalated').length,
    critical: issues.filter(i => i.priority === 'critical').length,
    resolved: issues.filter(i => i.status === 'resolved' || i.status === 'closed').length,
  };

  const findLinkedRisk = (riskId?: string) => {
    if (!riskId || !risks) return null;
    return risks.find(r => r.id === riskId);
  };

  const updateIssueMutation = useMutation({
    mutationFn: async (data: { id: string; updates: unknown }) => {
      const response = await apiRequest('PATCH', `/api/portfolio/issues/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('projectWorkspace.toast.issueUpdated'), description: t('projectWorkspace.toast.issueUpdatedDesc') });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId] });
      setEditingIssue(null);
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.updateFailed'), description: t('projectWorkspace.toast.failedUpdateIssue'), variant: "destructive" });
    },
  });

  const deleteIssueMutation = useMutation({
    mutationFn: async (issueId: string) => {
      const response = await apiRequest('DELETE', `/api/portfolio/issues/${issueId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('projectWorkspace.toast.issueDeleted'), description: t('projectWorkspace.toast.issueRemovedDesc') });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId] });
      setDeletingIssue(null);
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.deleteFailed'), description: t('projectWorkspace.toast.failedDeleteIssue'), variant: "destructive" });
    },
  });

  const quickStatusChange = (issueId: string, newStatus: string) => {
    updateIssueMutation.mutate({ id: issueId, updates: { status: newStatus } });
  };

  const escalateIssue = (issueId: string, currentLevel: number) => {
    updateIssueMutation.mutate({ 
      id: issueId, 
      updates: { 
        status: 'escalated', 
        escalationLevel: (currentLevel || 0) + 1 
      } 
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-6 gap-3">
        <Card className="bg-card/60 border-border p-3">
          <div className="text-xl font-bold text-foreground">{issueStats.total}</div>
          <div className="text-xs text-muted-foreground">Total Issues</div>
        </Card>
        <Card className="bg-blue-900/20 border-blue-800/30 p-3">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{issueStats.open}</div>
          <div className="text-xs text-muted-foreground">Open</div>
        </Card>
        <Card className="bg-amber-900/20 border-amber-800/30 p-3">
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{issueStats.inProgress}</div>
          <div className="text-xs text-muted-foreground">In Progress</div>
        </Card>
        <Card className="bg-red-900/20 border-red-800/30 p-3">
          <div className="text-xl font-bold text-red-600 dark:text-red-400">{issueStats.escalated}</div>
          <div className="text-xs text-muted-foreground">Escalated</div>
        </Card>
        <Card className="bg-purple-900/20 border-purple-800/30 p-3">
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{issueStats.critical}</div>
          <div className="text-xs text-muted-foreground">Critical Priority</div>
        </Card>
        <Card className="bg-emerald-900/20 border-emerald-800/30 p-3">
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{issueStats.resolved}</div>
          <div className="text-xs text-muted-foreground">Resolved</div>
        </Card>
      </div>

      <Card className="bg-card/60 border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Issue Tracker</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Track, manage, and resolve project issues</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search issues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-48 bg-muted/50 border-border/50"
                data-testid="input-search-issues"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32 bg-muted/50 border-border/50" data-testid="select-filter-issue-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-2" onClick={onAddIssue} data-testid="button-add-issue">
              <Plus className="w-4 h-4" />
              Add Issue
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {filteredIssues.map((issue) => {
                const linkedRisk = findLinkedRisk(issue.linkedRiskId);
                const isEscalated = issue.status === 'escalated';
                const isResolved = issue.status === 'resolved' || issue.status === 'closed';

                return (
                  <div
                    key={issue.id}
                    className={`p-4 bg-muted/40 border rounded-lg hover-elevate ${
                      isEscalated ? 'border-red-500/50 ring-1 ring-red-500/30' : 
                      isResolved ? 'border-emerald-500/30' :
                      'border-border/50'
                    }`}
                    data-testid={`issue-${issue.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={priorityColors[issue.priority] || ''}>
                            {issue.priority}
                          </Badge>
                          <span className="text-xs text-muted-foreground/70 font-mono">{issue.issueCode}</span>
                          <Badge variant="outline" className="text-xs capitalize">{issue.issueType?.replace(/_/g, ' ')}</Badge>
                          {isEscalated && (
                            <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 gap-1">
                              <ArrowUp className="w-3 h-3" />
                              Escalated L{issue.escalationLevel || 1}
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium mt-2">{issue.title}</h4>
                        {issue.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{issue.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Severity: {issue.severity}
                          </span>
                          {issue.assignedTo && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              Assigned: {issue.assignedTo}
                            </span>
                          )}
                          {issue.reportedDate && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              Reported: {new Date(issue.reportedDate).toLocaleDateString()}
                            </span>
                          )}
                          {issue.dueDate && (
                            <span className={`flex items-center gap-1 ${
                              new Date(issue.dueDate) < new Date() ? 'text-red-600 dark:text-red-400' : ''
                            }`}>
                              <Clock className="w-3 h-3" />
                              Due: {new Date(issue.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {linkedRisk && (
                          <div className="mt-3 p-2 bg-orange-900/20 border border-orange-700/30 rounded flex items-center gap-2">
                            <LinkIcon className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                            <span className="text-xs text-orange-600 dark:text-orange-400">Linked Risk:</span>
                            <span className="text-xs text-foreground/80">{linkedRisk.title}</span>
                            <Badge variant="outline" className={`text-xs ${riskLevelColors[linkedRisk.riskLevel] || ''}`}>
                              {linkedRisk.riskLevel}
                            </Badge>
                          </div>
                        )}
                        {issue.resolution && (
                          <div className="mt-3 p-3 bg-emerald-900/20 border border-emerald-700/30 rounded">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Resolution</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{issue.resolution}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={statusColors[issue.status] || ''}>
                          {issue.status?.replace(/_/g, ' ')}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditingIssue(issue)}
                            data-testid={`button-edit-issue-${issue.id}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500 hover:text-red-600"
                            onClick={() => setDeletingIssue(issue)}
                            data-testid={`button-delete-issue-${issue.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {!isResolved && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap border-t border-border/30 pt-3">
                        <span className="text-xs text-muted-foreground mr-2">Quick Actions:</span>
                        {issue.status !== 'in_progress' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs gap-1"
                            onClick={() => quickStatusChange(issue.id, 'in_progress')}
                            disabled={updateIssueMutation.isPending}
                          >
                            <Play className="w-3 h-3" />
                            Start Working
                          </Button>
                        )}
                        {issue.status !== 'resolved' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs gap-1 text-emerald-600"
                            onClick={() => quickStatusChange(issue.id, 'resolved')}
                            disabled={updateIssueMutation.isPending}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Resolve
                          </Button>
                        )}
                        {issue.status !== 'escalated' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs gap-1 text-red-600"
                            onClick={() => escalateIssue(issue.id, issue.escalationLevel || 0)}
                            disabled={updateIssueMutation.isPending}
                          >
                            <ArrowUpCircle className="w-3 h-3" />
                            Escalate
                          </Button>
                        )}
                        {issue.status === 'escalated' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs gap-1 text-amber-600"
                            onClick={() => escalateIssue(issue.id, issue.escalationLevel || 0)}
                            disabled={updateIssueMutation.isPending}
                          >
                            <ArrowUpCircle className="w-3 h-3" />
                            Escalate to L{(issue.escalationLevel || 1) + 1}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {!filteredIssues.length && (
                <div className="text-center text-muted-foreground/70 py-12">
                  <Bug className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No issues found. Great! Your project is running smoothly.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={onAddIssue}
                    data-testid="button-add-first-issue"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Log First Issue
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!editingIssue} onOpenChange={(open) => !open && setEditingIssue(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-500" />
              Edit Issue
            </DialogTitle>
            <DialogDescription>
              Update issue details, status, and resolution
            </DialogDescription>
          </DialogHeader>
          {editingIssue && (
            <IssueEditForm
              issue={editingIssue}
              onSave={(updates) => updateIssueMutation.mutate({ id: editingIssue.id, updates })}
              onCancel={() => setEditingIssue(null)}
              isLoading={updateIssueMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingIssue} onOpenChange={(open) => !open && setDeletingIssue(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Issue
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingIssue?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingIssue && deleteIssueMutation.mutate(deletingIssue.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteIssueMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IssueEditForm({ issue, onSave, onCancel, isLoading }: {
  issue: IssueData;
  onSave: (updates: unknown) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description || '');
  const [status, setStatus] = useState(issue.status);
  const [priority, setPriority] = useState(issue.priority);
  const [severity, setSeverity] = useState(issue.severity || 'medium');
  const [resolution, setResolution] = useState(issue.resolution || '');
  const [assignedTo, setAssignedTo] = useState(issue.assignedTo || '');

  const handleSave = () => {
    onSave({
      title,
      description,
      status,
      priority,
      severity,
      resolution: resolution || null,
      assignedTo: assignedTo || null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">{issue.issueCode}</Badge>
          <Badge className={priorityColors[issue.priority] || ''}>{issue.priority}</Badge>
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
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
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
          <Label>Severity</Label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="major">Major</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="minor">Minor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Assigned To</Label>
          <Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Enter name" />
        </div>
      </div>

      {(status === 'resolved' || status === 'closed') && (
        <div className="space-y-2">
          <Label>Resolution</Label>
          <Textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Describe how the issue was resolved..."
            rows={3}
          />
        </div>
      )}

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
