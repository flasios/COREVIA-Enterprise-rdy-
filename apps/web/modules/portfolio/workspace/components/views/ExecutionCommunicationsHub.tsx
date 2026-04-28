import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Bell,
  FileText,
  BarChart3,
  CheckCircle2,
  ListTodo,
  MessageSquare,
  Plus,
  CalendarDays,
  Users,
  Mail,
  Send,
  Zap,
  Radio,
  Clock,
  Flag,
  AlertTriangle,
  AlertCircle,
  Activity,
  Target,
  Eye as _Eye,
  Loader2,
  ArrowUpRight,
  TrendingUp as _TrendingUp,
  Filter,
  Search,
  Megaphone,
  Play,
  Sparkles,
  PenLine,
  LayoutDashboard,
  BookOpen,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ProjectData, CommunicationData, StakeholderData } from '../../types';

interface ExecutionCommunicationsHubProps {
  project: ProjectData;
  communications: CommunicationData[];
  stakeholders?: StakeholderData[];
}

interface CommunicationChannel {
  id: string;
  name: string;
  frequency: string;
  audience: string;
  format?: string;
  owner: string;
  isActive: boolean;
  autoTrigger: boolean;
  nextScheduled?: string;
}

interface AutoTrigger {
  id: string;
  name: string;
  triggerType: string;
  condition: string;
  templateId: string;
  isActive: boolean;
  lastTriggered?: string;
}

interface CommunicationPlan {
  channels?: CommunicationChannel[];
  autoTriggers?: AutoTrigger[];
  isApproved?: boolean;
}

interface MessageTemplate {
  id: string;
  type: string;
  name: string;
  description: string;
  subject: string;
  content: string;
  recipients: string[];
  isActive: boolean;
}

type ActiveView = 'command-center' | 'log' | 'compose' | 'engagement';

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'status', type: 'Status Update', name: 'Weekly Status Report',
    description: 'Regular progress reports',
    subject: 'Project Status Update - {{project_name}} - Week {{week_number}}',
    content: `Dear {{recipient_name}},\n\nPlease find below the weekly status update for {{project_name}}:\n\n**Overall Health:** {{health_status}}\n**Progress:** {{progress_percentage}}%\n\n**Key Accomplishments This Week:**\n{{accomplishments}}\n\n**Planned Activities Next Week:**\n{{planned_activities}}\n\n**Risks & Issues:**\n{{risks_issues}}\n\nBest regards,\n{{sender_name}}\nProject Manager`,
    recipients: ['sponsor', 'stakeholders'], isActive: true,
  },
  {
    id: 'milestone', type: 'Milestone Achieved', name: 'Milestone Completion',
    description: 'Celebrate key achievements',
    subject: 'Milestone Achieved - {{milestone_name}} - {{project_name}}',
    content: `Dear Team,\n\nWe are pleased to announce that we have successfully completed the following milestone:\n\n**Milestone:** {{milestone_name}}\n**Completion Date:** {{completion_date}}\n**Project:** {{project_name}}\n\n**Key Deliverables:**\n{{deliverables}}\n\nThank you to everyone who contributed.\n\nBest regards,\n{{sender_name}}`,
    recipients: ['all'], isActive: true,
  },
  {
    id: 'issue', type: 'Issue Alert', name: 'Critical Issue Notification',
    description: 'Communicate problems early',
    subject: 'URGENT: Issue Alert - {{issue_title}} - {{project_name}}',
    content: `Dear {{recipient_name}},\n\nAn issue requiring immediate attention has been identified:\n\n**Issue:** {{issue_title}}\n**Priority:** {{priority}}\n**Impact:** {{impact_description}}\n\n**Immediate Actions Required:**\n{{required_actions}}\n\n**Resolution Timeline:** {{resolution_timeline}}\n\nPlease respond by {{response_deadline}}.\n\nBest regards,\n{{sender_name}}`,
    recipients: ['sponsor', 'pmo'], isActive: true,
  },
  {
    id: 'decision', type: 'Decision Required', name: 'Decision Request',
    description: 'Request stakeholder input',
    subject: 'Decision Required - {{decision_topic}} - {{project_name}}',
    content: `Dear {{recipient_name}},\n\nYour decision is required on the following matter:\n\n**Topic:** {{decision_topic}}\n**Project:** {{project_name}}\n**Decision Deadline:** {{decision_deadline}}\n\n**Background:**\n{{background}}\n\n**Options:**\n{{options}}\n\n**Recommendation:**\n{{recommendation}}\n\nPlease provide your decision by {{decision_deadline}}.\n\nBest regards,\n{{sender_name}}`,
    recipients: ['sponsor'], isActive: true,
  },
  {
    id: 'change', type: 'Change Notice', name: 'Change Request Notification',
    description: 'Inform about changes',
    subject: 'Change Notice - {{change_title}} - {{project_name}}',
    content: `Dear {{recipient_name}},\n\nPlease be informed of the following change to {{project_name}}:\n\n**Change:** {{change_title}}\n**Type:** {{change_type}}\n**Effective Date:** {{effective_date}}\n\n**Impact:**\n{{impact_description}}\n\n**Actions Required:**\n{{required_actions}}\n\nBest regards,\n{{sender_name}}`,
    recipients: ['stakeholders'], isActive: true,
  },
  {
    id: 'meeting', type: 'Meeting Invitation', name: 'Project Meeting',
    description: 'Schedule project meetings',
    subject: 'Meeting Invitation - {{meeting_title}} - {{project_name}}',
    content: `Dear {{recipient_name}},\n\nYou are invited to attend the following meeting:\n\n**Meeting:** {{meeting_title}}\n**Date:** {{meeting_date}}\n**Time:** {{meeting_time}}\n**Duration:** {{duration}}\n\n**Agenda:**\n{{agenda}}\n\nPlease confirm your attendance.\n\nBest regards,\n{{sender_name}}`,
    recipients: ['attendees'], isActive: true,
  },
];

const commTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  announcement: Bell,
  meeting_minutes: FileText,
  status_report: BarChart3,
  decision: CheckCircle2,
  action_item: ListTodo,
  escalation: AlertTriangle,
  change_notice: Megaphone,
  milestone_update: Flag,
  risk_alert: AlertCircle,
  newsletter: BookOpen,
  general: MessageSquare,
};

const commTypeColors: Record<string, string> = {
  announcement: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  meeting_minutes: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  status_report: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  decision: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  action_item: 'bg-red-500/20 text-red-600 dark:text-red-400',
  escalation: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  change_notice: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
  milestone_update: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  risk_alert: 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
  newsletter: 'bg-teal-500/20 text-teal-600 dark:text-teal-400',
  general: 'bg-muted/50 text-muted-foreground',
};

const triggerTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  milestone: Flag,
  phase_gate: CheckCircle2,
  risk_threshold: AlertTriangle,
  schedule: Clock,
  issue_escalation: AlertCircle,
};

export function ExecutionCommunicationsHub({
  project,
  communications,
  stakeholders = [],
}: ExecutionCommunicationsHubProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<ActiveView>('command-center');
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [composeData, setComposeData] = useState({
    communicationType: 'status_report' as string,
    title: '',
    content: '',
    priority: 'normal',
  });

  const { data: planResponse } = useQuery<{ success: boolean; data: CommunicationPlan | null }>({
    queryKey: ['/api/portfolio/projects', project.id, 'communication-plan'],
  });

  const initiationPlan = planResponse?.data;
  const planChannels = initiationPlan?.channels || [];
  const planTriggers = initiationPlan?.autoTriggers || [];
  const planIsActive = initiationPlan?.isApproved || false;

  const activeChannels = planChannels.filter(c => c.isActive);
  const activeTriggers = planTriggers.filter(t => t.isActive);

  const createCommMutation = useMutation({
    mutationFn: async (data: { communicationType: string; title: string; content: string; priority: string }) => {
      return apiRequest('POST', `/api/portfolio/projects/${project.id}/communications`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
      setShowComposeDialog(false);
      setComposeData({ communicationType: 'status_report', title: '', content: '', priority: 'normal' });
      setSelectedTemplateId(null);
      toast({ title: t('projectWorkspace.toast.communicationCreated'), description: t('projectWorkspace.toast.communicationSavedDesc') });
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.failed'), description: t('projectWorkspace.toast.couldNotCreateCommunicationDesc'), variant: 'destructive' });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (commId: string) => {
      return apiRequest('POST', `/api/portfolio/communications/${commId}/publish`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
      toast({ title: t('projectWorkspace.toast.published'), description: t('projectWorkspace.toast.communicationPublishedDesc') });
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.publishFailed'), description: t('projectWorkspace.toast.couldNotPublishCommunicationDesc'), variant: 'destructive' });
    },
  });

  const executeTriggerMutation = useMutation({
    mutationFn: async (trigger: AutoTrigger) => {
      return apiRequest('POST', `/api/portfolio/projects/${project.id}/communication-plan/execute-trigger`, {
        triggerId: trigger.id,
        triggerName: trigger.name,
        triggerType: trigger.triggerType,
      });
    },
    onSuccess: (_, trigger) => {
      toast({ title: t('projectWorkspace.toast.triggerExecuted'), description: t('projectWorkspace.toast.triggerNotificationSentDesc', { triggerName: trigger.name }) });
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.triggerFailed'), description: t('projectWorkspace.toast.couldNotExecuteTriggerDesc'), variant: 'destructive' });
    },
  });

  const filteredComms = useMemo(() => {
    return communications.filter(comm => {
      const matchesType = filterType === 'all' || comm.communicationType === filterType;
      const matchesSearch = !searchTerm ||
        comm.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comm.content?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [communications, filterType, searchTerm]);

  const commStats = useMemo(() => ({
    total: communications.length,
    published: communications.filter(c => c.status === 'published').length,
    draft: communications.filter(c => c.status === 'draft').length,
    announcements: communications.filter(c => c.communicationType === 'announcement').length,
    meetings: communications.filter(c => c.communicationType === 'meeting_minutes').length,
    decisions: communications.filter(c => c.communicationType === 'decision').length,
    thisWeek: communications.filter(c => {
      if (!c.createdAt) return false;
      const d = new Date(c.createdAt);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    }).length,
  }), [communications]);

  const stakeholderEngagement = useMemo(() => {
    return stakeholders.map(s => {
      const relatedComms = communications.filter(c =>
        c.recipients?.includes(s.name) ||
        c.recipients?.includes(s.email || '') ||
        c.author === s.name
      );
      const lastComm = relatedComms.length > 0
        ? relatedComms.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]
        : null;
      const daysSinceContact = lastComm?.createdAt
        ? Math.floor((Date.now() - new Date(lastComm.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      let healthScore = 100;
      if (daysSinceContact > 30) healthScore = 20;
      else if (daysSinceContact > 14) healthScore = 50;
      else if (daysSinceContact > 7) healthScore = 75;

      const preferredFreq = s.communicationFrequency || 'weekly';
      const maxDayMap: Record<string, number> = { daily: 2, weekly: 10, biweekly: 18, monthly: 35, as_needed: 60, asneeded: 60 };
      const maxDays = maxDayMap[preferredFreq] || 14;
      if (daysSinceContact > maxDays) healthScore = Math.min(healthScore, 40);

      return {
        ...s,
        commCount: relatedComms.length,
        lastContactDate: lastComm?.createdAt || null,
        daysSinceContact,
        healthScore,
        preferredFrequency: preferredFreq,
      };
    }).sort((a, b) => a.healthScore - b.healthScore);
  }, [stakeholders, communications]);

  const handleSelectTemplate = (templateId: string) => {
    const template = DEFAULT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      const typeMap: Record<string, string> = {
        status: 'status_report', milestone: 'milestone_update', issue: 'escalation',
        decision: 'decision', change: 'change_notice', meeting: 'meeting_minutes',
      };
      const personalizedSubject = template.subject
        .replace(/\{\{project_name\}\}/g, project.projectName || 'Project')
        .replace(/\{\{.*?\}\}/g, '[...]');
      const personalizedContent = template.content
        .replace(/\{\{project_name\}\}/g, project.projectName || 'Project')
        .replace(/\{\{sender_name\}\}/g, project.projectManager || 'Project Manager')
        .replace(/\{\{.*?\}\}/g, '[...]');
      setComposeData({
        communicationType: typeMap[templateId] || 'status_report',
        title: personalizedSubject,
        content: personalizedContent,
        priority: templateId === 'issue' ? 'high' : 'normal',
      });
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getHealthBg = (score: number) => {
    if (score >= 75) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 50) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 75) return 'Healthy';
    if (score >= 50) return 'Needs Attention';
    return 'At Risk';
  };

  const viewConfig = [
    { id: 'command-center' as ActiveView, label: 'Command Center', icon: LayoutDashboard },
    { id: 'log' as ActiveView, label: 'Communications Log', icon: MessageSquare },
    { id: 'compose' as ActiveView, label: 'Quick Compose', icon: PenLine },
    { id: 'engagement' as ActiveView, label: 'Engagement Tracker', icon: Activity },
  ];

  return (
    <div className="space-y-4">
      {/* Header with Plan Sync Status */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-violet-500/5 border border-border/50 p-4">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-violet-500/10 to-cyan-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-500 to-violet-600 flex items-center justify-center shadow-lg">
                <Radio className="w-6 h-6 text-white" />
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 opacity-30 blur-md -z-10" />
              {planIsActive && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent dark:from-cyan-400 dark:to-blue-400">
                  Communications Hub
                </h3>
                <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground">Execution Phase</p>
                {planIsActive && (
                  <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1">
                    <Zap className="w-2.5 h-2.5" />
                    Plan Active
                  </Badge>
                )}
                {!planIsActive && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
                    Plan Inactive
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="hidden sm:block h-10 w-px bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {commStats.total} Total
              </Badge>
              <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                {commStats.published} Published
              </Badge>
              <Badge className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                {activeChannels.length} Channels
              </Badge>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm">
              {viewConfig.map((view) => (
                <button
                  key={view.id}
                  onClick={() => setActiveView(view.id)}
                  className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                    activeView === view.id
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  <view.icon className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">{view.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========== COMMAND CENTER VIEW ========== */}
      {activeView === 'command-center' && (
        <div className="space-y-4">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-card/60 border-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-cyan-500" />
                <span className="text-xs text-muted-foreground">Total Comms</span>
              </div>
              <div className="text-2xl font-bold">{commStats.total}</div>
              <div className="text-[10px] text-muted-foreground">{commStats.thisWeek} this week</div>
            </Card>
            <Card className="bg-card/60 border-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Send className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Published</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{commStats.published}</div>
              <div className="text-[10px] text-muted-foreground">{commStats.draft} drafts pending</div>
            </Card>
            <Card className="bg-card/60 border-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Active Channels</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{activeChannels.length}</div>
              <div className="text-[10px] text-muted-foreground">{planChannels.length} total defined</div>
            </Card>
            <Card className="bg-card/60 border-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">Auto Triggers</span>
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{activeTriggers.length}</div>
              <div className="text-[10px] text-muted-foreground">{planTriggers.length} configured</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Initiation Plan Channels */}
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-500" />
                    Communication Channels
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">From Initiation Plan</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {activeChannels.length}/{planChannels.length} Active
                </Badge>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[280px]">
                  {planChannels.length > 0 ? (
                    <div className="space-y-2">
                      {planChannels.map((channel) => (
                        <div
                          key={channel.id}
                          className={`p-3 rounded-lg border transition-all ${
                            channel.isActive
                              ? 'bg-muted/30 border-border/50'
                              : 'bg-muted/10 border-border/30 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {channel.isActive && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                              )}
                              {!channel.isActive && (
                                <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
                              )}
                              <span className="text-sm font-medium truncate">{channel.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="outline" className="text-[10px]">{channel.frequency}</Badge>
                              {channel.autoTrigger && (
                                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-0.5">
                                  <Zap className="w-2.5 h-2.5" />
                                  Auto
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {channel.audience}
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              {channel.owner}
                            </span>
                            {channel.nextScheduled && (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                {channel.nextScheduled}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Radio className="w-8 h-8 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">{t('projectWorkspace.communications.noChannelsDefined')}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Set up communication channels in the Initiation Phase Stakeholder Hub</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Active Triggers */}
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Auto Triggers
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Event-based automation</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {activeTriggers.length}/{planTriggers.length} Active
                </Badge>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[280px]">
                  {planTriggers.length > 0 ? (
                    <div className="space-y-2">
                      {planTriggers.map((trigger) => {
                        const TriggerIcon = triggerTypeIcons[trigger.triggerType] || Bell;
                        return (
                          <div
                            key={trigger.id}
                            className={`p-3 rounded-lg border transition-all ${
                              trigger.isActive
                                ? 'bg-muted/30 border-border/50'
                                : 'bg-muted/10 border-border/30 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <TriggerIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium truncate">{trigger.name}</span>
                                    {trigger.isActive && (
                                      <Badge className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                        Active
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{trigger.condition}</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 text-xs shrink-0"
                                disabled={!trigger.isActive || executeTriggerMutation.isPending}
                                onClick={() => executeTriggerMutation.mutate(trigger)}
                              >
                                {executeTriggerMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Play className="w-3 h-3" />
                                )}
                                Run
                              </Button>
                            </div>
                            {trigger.lastTriggered && (
                              <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                Last: {trigger.lastTriggered}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Zap className="w-8 h-8 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">{t('projectWorkspace.communications.noTriggersConfigured')}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Configure auto triggers in the Initiation Phase</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Recent Communications Summary */}
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Recent Activity
              </CardTitle>
              <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => setActiveView('log')}>
                View All <ArrowUpRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {communications.length > 0 ? (
                <div className="space-y-2">
                  {communications.slice(0, 5).map((comm) => {
                    const TypeIcon = commTypeIcons[comm.communicationType] || MessageSquare;
                    const typeColor = commTypeColors[comm.communicationType] || commTypeColors.general;
                    return (
                      <div key={comm.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className={`p-1.5 rounded-md ${typeColor}`}>
                          <TypeIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{comm.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {comm.communicationType?.replace(/_/g, ' ')}
                            {comm.createdAt && ` - ${new Date(comm.createdAt).toLocaleDateString()}`}
                          </p>
                        </div>
                        <Badge
                          variant={comm.status === 'published' ? 'default' : 'outline'}
                          className={`text-[10px] ${comm.status === 'published' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : ''}`}
                        >
                          {comm.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('projectWorkspace.communications.noCommunicationsYet')}</p>
                  <Button size="sm" variant="outline" className="mt-2 gap-1" onClick={() => setActiveView('compose')}>
                    <PenLine className="w-3 h-3" />
                    Create First Communication
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stakeholder Engagement Summary */}
          {stakeholderEngagement.length > 0 && (
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-500" />
                  Engagement Health
                </CardTitle>
                <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => setActiveView('engagement')}>
                  Details <ArrowUpRight className="w-3 h-3" />
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 flex-wrap">
                  {stakeholderEngagement.slice(0, 6).map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold border-2 ${
                        s.healthScore >= 75 ? 'border-emerald-500/50' : s.healthScore >= 50 ? 'border-amber-500/50' : 'border-red-500/50'
                      }`}>
                        {s.name?.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <p className="text-xs font-medium truncate max-w-[80px]">{s.name?.split(' ')[0]}</p>
                        <p className={`text-[10px] font-medium ${getHealthColor(s.healthScore)}`}>
                          {s.healthScore}%
                        </p>
                      </div>
                    </div>
                  ))}
                  {stakeholderEngagement.length > 6 && (
                    <Badge variant="outline" className="text-[10px]">+{stakeholderEngagement.length - 6} more</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ========== COMMUNICATIONS LOG VIEW ========== */}
      {activeView === 'log' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('projectWorkspace.communications.searchCommunications')}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-44">
                <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder={t('projectWorkspace.communications.filterType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="announcement">Announcements</SelectItem>
                <SelectItem value="meeting_minutes">Meeting Minutes</SelectItem>
                <SelectItem value="status_report">Status Reports</SelectItem>
                <SelectItem value="decision">Decisions</SelectItem>
                <SelectItem value="action_item">Action Items</SelectItem>
                <SelectItem value="escalation">Escalations</SelectItem>
                <SelectItem value="milestone_update">Milestone Updates</SelectItem>
                <SelectItem value="risk_alert">Risk Alerts</SelectItem>
              </SelectContent>
            </Select>
            <Button className="gap-2" onClick={() => { setShowComposeDialog(true); setSelectedTemplateId(null); setComposeData({ communicationType: 'status_report', title: '', content: '', priority: 'normal' }); }}>
              <Plus className="w-4 h-4" />
              New Communication
            </Button>
          </div>

          <div className="grid grid-cols-5 gap-3">
            <Card className="bg-card/60 border-border p-3">
              <div className="text-xl font-bold">{commStats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </Card>
            <Card className="bg-purple-500/10 border-purple-500/20 p-3">
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{commStats.announcements}</div>
              <div className="text-xs text-muted-foreground">Announcements</div>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/20 p-3">
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{commStats.meetings}</div>
              <div className="text-xs text-muted-foreground">Meetings</div>
            </Card>
            <Card className="bg-amber-500/10 border-amber-500/20 p-3">
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{commStats.decisions}</div>
              <div className="text-xs text-muted-foreground">Decisions</div>
            </Card>
            <Card className="bg-emerald-500/10 border-emerald-500/20 p-3">
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{commStats.published}</div>
              <div className="text-xs text-muted-foreground">Published</div>
            </Card>
          </div>

          <Card className="bg-card/60 border-border">
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y divide-border">
                  {filteredComms.map((comm) => {
                    const TypeIcon = commTypeIcons[comm.communicationType] || MessageSquare;
                    const typeColor = commTypeColors[comm.communicationType] || commTypeColors.general;
                    return (
                      <div key={comm.id} className="p-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded-lg shrink-0 ${typeColor}`}>
                            <TypeIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="capitalize text-xs">
                                  {comm.communicationType?.replace(/_/g, ' ')}
                                </Badge>
                                {comm.priority && comm.priority !== 'normal' && (
                                  <Badge className={
                                    comm.priority === 'urgent' ? 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30' :
                                    comm.priority === 'high' ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30' :
                                    'bg-muted text-muted-foreground'
                                  }>
                                    {comm.priority}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={
                                  comm.status === 'published'
                                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                    : comm.status === 'draft'
                                    ? 'bg-muted text-muted-foreground'
                                    : 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30'
                                }>
                                  {comm.status}
                                </Badge>
                                {comm.status === 'draft' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 h-7 text-xs"
                                    onClick={() => publishMutation.mutate(comm.id)}
                                    disabled={publishMutation.isPending}
                                  >
                                    {publishMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                    Publish
                                  </Button>
                                )}
                              </div>
                            </div>
                            <h4 className="font-medium mt-2">{comm.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{comm.content}</p>
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground/70">
                              {comm.createdAt && (
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="w-3 h-3" />
                                  {new Date(comm.createdAt).toLocaleDateString()}
                                </span>
                              )}
                              {comm.author && (
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {comm.author}
                                </span>
                              )}
                              {comm.recipients && comm.recipients.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {comm.recipients.length} recipient{comm.recipients.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredComms.length === 0 && (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                      <p className="text-muted-foreground">
                        {searchTerm || filterType !== 'all' ? 'No communications match your filters' : 'No communications recorded yet'}
                      </p>
                      <Button size="sm" variant="outline" className="mt-4 gap-2" onClick={() => { setShowComposeDialog(true); setSelectedTemplateId(null); }}>
                        <Plus className="w-4 h-4" />
                        Create First Communication
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== QUICK COMPOSE VIEW ========== */}
      {activeView === 'compose' && (
        <div className="space-y-4">
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                Template-Powered Compose
              </CardTitle>
              <p className="text-xs text-muted-foreground">Select a template from your Communication Plan to auto-populate</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {DEFAULT_TEMPLATES.map((template) => {
                  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
                    status: BarChart3, milestone: Flag, issue: AlertTriangle,
                    decision: CheckCircle2, change: Megaphone, meeting: CalendarDays,
                  };
                  const colorMap: Record<string, string> = {
                    status: 'blue', milestone: 'emerald', issue: 'amber',
                    decision: 'purple', change: 'orange', meeting: 'cyan',
                  };
                  const TemplateIcon = iconMap[template.id] || MessageSquare;
                  const color = colorMap[template.id] || 'gray';
                  const isSelected = selectedTemplateId === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template.id)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isSelected
                          ? `bg-${color}-500/15 border-${color}-500/40 shadow-sm`
                          : 'bg-muted/30 border-border/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center bg-${color}-500/20`}>
                        <TemplateIcon className={`w-5 h-5 text-${color}-600 dark:text-${color}-400`} />
                      </div>
                      <p className="text-xs font-medium">{template.type}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{template.description}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <PenLine className="w-4 h-4" />
                {selectedTemplateId ? `Compose: ${DEFAULT_TEMPLATES.find(t => t.id === selectedTemplateId)?.type}` : 'Compose Communication'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={composeData.communicationType}
                      onValueChange={(v) => setComposeData(prev => ({ ...prev, communicationType: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="announcement">Announcement</SelectItem>
                        <SelectItem value="meeting_minutes">Meeting Minutes</SelectItem>
                        <SelectItem value="status_report">Status Report</SelectItem>
                        <SelectItem value="decision">Decision</SelectItem>
                        <SelectItem value="action_item">Action Item</SelectItem>
                        <SelectItem value="escalation">Escalation</SelectItem>
                        <SelectItem value="change_notice">Change Notice</SelectItem>
                        <SelectItem value="milestone_update">Milestone Update</SelectItem>
                        <SelectItem value="risk_alert">Risk Alert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={composeData.priority}
                      onValueChange={(v) => setComposeData(prev => ({ ...prev, priority: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Title / Subject</Label>
                  <Input
                    value={composeData.title}
                    onChange={(e) => setComposeData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={t('projectWorkspace.communications.enterCommunicationTitle')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    value={composeData.content}
                    onChange={(e) => setComposeData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder={t('projectWorkspace.communications.writeCommunicationContent')}
                    className="min-h-[200px]"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {selectedTemplateId && 'Template variables like [...]  will be replaced with actual values when sent'}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setComposeData({ communicationType: 'status_report', title: '', content: '', priority: 'normal' });
                        setSelectedTemplateId(null);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      className="gap-2"
                      disabled={!composeData.title || !composeData.content || createCommMutation.isPending}
                      onClick={() => createCommMutation.mutate(composeData)}
                    >
                      {createCommMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Save as Draft
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== ENGAGEMENT TRACKER VIEW ========== */}
      {activeView === 'engagement' && (
        <div className="space-y-4">
          {/* Engagement Summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-emerald-500/5 border-emerald-500/20 p-3">
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {stakeholderEngagement.filter(s => s.healthScore >= 75).length}
              </div>
              <div className="text-xs text-muted-foreground">Healthy Engagement</div>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/20 p-3">
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {stakeholderEngagement.filter(s => s.healthScore >= 50 && s.healthScore < 75).length}
              </div>
              <div className="text-xs text-muted-foreground">Needs Attention</div>
            </Card>
            <Card className="bg-red-500/5 border-red-500/20 p-3">
              <div className="text-xl font-bold text-red-600 dark:text-red-400">
                {stakeholderEngagement.filter(s => s.healthScore < 50).length}
              </div>
              <div className="text-xs text-muted-foreground">At Risk</div>
            </Card>
          </div>

          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-500" />
                Stakeholder Engagement Health
              </CardTitle>
              <p className="text-xs text-muted-foreground">Based on communication frequency and last contact date</p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px]">
                {stakeholderEngagement.length > 0 ? (
                  <div className="space-y-3">
                    {stakeholderEngagement.map((stakeholder) => (
                      <div
                        key={stakeholder.id}
                        className={`p-4 rounded-xl border transition-all ${getHealthBg(stakeholder.healthScore)}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold border-2 ${
                              stakeholder.healthScore >= 75 ? 'border-emerald-500/50' : stakeholder.healthScore >= 50 ? 'border-amber-500/50' : 'border-red-500/50'
                            }`}>
                              {stakeholder.name?.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{stakeholder.name}</div>
                              <div className="text-xs text-muted-foreground">{stakeholder.title || stakeholder.role}</div>
                              {stakeholder.email && (
                                <div className="text-[10px] text-blue-600 dark:text-blue-400">{stakeholder.email}</div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-center">
                              <div className={`text-lg font-bold ${getHealthColor(stakeholder.healthScore)}`}>
                                {stakeholder.healthScore}%
                              </div>
                              <div className={`text-[10px] font-medium ${getHealthColor(stakeholder.healthScore)}`}>
                                {getHealthLabel(stakeholder.healthScore)}
                              </div>
                            </div>

                            <div className="hidden sm:flex flex-col gap-1 text-right">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MessageSquare className="w-3 h-3" />
                                {stakeholder.commCount} communications
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {stakeholder.lastContactDate
                                  ? `${stakeholder.daysSinceContact}d ago`
                                  : 'No contact yet'
                                }
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <CalendarDays className="w-3 h-3" />
                                Pref: {stakeholder.preferredFrequency.replace(/_/g, ' ')}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Health Bar */}
                        <div className="mt-3">
                          <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                stakeholder.healthScore >= 75 ? 'bg-emerald-500' :
                                stakeholder.healthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${stakeholder.healthScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{t('projectWorkspace.communications.noStakeholdersToTrack')}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Add stakeholders in the Initiation Phase Stakeholder Hub</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== COMPOSE DIALOG (from Log view) ========== */}
      <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-5 h-5 text-cyan-600" />
              New Communication
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={composeData.communicationType}
                  onValueChange={(v) => setComposeData(prev => ({ ...prev, communicationType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="meeting_minutes">Meeting Minutes</SelectItem>
                    <SelectItem value="status_report">Status Report</SelectItem>
                    <SelectItem value="decision">Decision</SelectItem>
                    <SelectItem value="action_item">Action Item</SelectItem>
                    <SelectItem value="escalation">Escalation</SelectItem>
                    <SelectItem value="change_notice">Change Notice</SelectItem>
                    <SelectItem value="milestone_update">Milestone Update</SelectItem>
                    <SelectItem value="risk_alert">Risk Alert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={composeData.priority}
                  onValueChange={(v) => setComposeData(prev => ({ ...prev, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={composeData.title}
                onChange={(e) => setComposeData(prev => ({ ...prev, title: e.target.value }))}
                placeholder={t('projectWorkspace.communications.communicationTitle')}
              />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={composeData.content}
                onChange={(e) => setComposeData(prev => ({ ...prev, content: e.target.value }))}
                placeholder={t('projectWorkspace.communications.writeCommunication')}
                className="min-h-[150px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowComposeDialog(false)}>Cancel</Button>
            <Button
              className="gap-2"
              disabled={!composeData.title || !composeData.content || createCommMutation.isPending}
              onClick={() => createCommMutation.mutate(composeData)}
            >
              {createCommMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Save as Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
