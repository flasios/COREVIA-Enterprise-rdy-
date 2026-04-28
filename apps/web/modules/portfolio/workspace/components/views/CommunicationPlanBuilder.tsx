import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface UserData {
  id: string;
  displayName: string;
  email: string;
  department?: string;
  role?: string;
}

interface TeamData {
  id: string;
  name: string;
  description?: string;
}

interface SteeringCommitteeMember {
  userId: string;
  displayName: string;
}

interface GovernanceStructure {
  roles?: string[];
  committees?: string[];
}

interface ProjectMetadata {
  governanceStructure?: GovernanceStructure;
  steeringCommitteeMembers?: SteeringCommitteeMember[];
  [key: string]: unknown;
}

interface GovernanceOwner {
  id: string;
  name: string;
  role: string;
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import {
  Mail,
  Plus,
  MessageSquare,
  FileText,
  Users,
  BarChart3,
  Flag,
  AlertTriangle,
  Shield,
  RefreshCw,
  Calendar,
  Clock,
  Bell,
  Zap,
  CheckCircle2,
  Play,
  Pause as _Pause,
  Settings,
  Send,
  Edit,
  Copy,
  CalendarClock,
  Megaphone as _Megaphone,
  Target as _Target,
  TrendingUp as _TrendingUp,
  AlertCircle,
  UserCheck as _UserCheck,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ProjectData, BusinessCaseData, StakeholderData } from "../../types";

interface CommunicationPlanBuilderProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  stakeholders: StakeholderData[];
}

interface CommunicationChannel {
  id: string;
  name: string;
  frequency: string;
  audience: string;
  format: string;
  owner: string;
  isActive: boolean;
  autoTrigger: boolean;
  nextScheduled?: string;
}

interface MessageTemplate {
  id: string;
  type: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
  subject: string;
  content: string;
  recipients: string[];
  isActive: boolean;
}

interface AutoTrigger {
  id: string;
  name: string;
  triggerType: 'milestone' | 'phase_gate' | 'risk_threshold' | 'schedule' | 'issue_escalation';
  condition: string;
  templateId: string;
  isActive: boolean;
  lastTriggered?: string;
}

interface SavedCommunicationPlan {
  channels?: CommunicationChannel[];
  autoTriggers?: AutoTrigger[];
  isApproved?: boolean;
}

interface ExecuteTriggerResponse {
  data?: {
    notificationsSent?: number;
    emailsSent?: number;
  };
}

interface APIError {
  message?: string;
}

export function CommunicationPlanBuilder({
  project,
   
  businessCase: _businessCase,
  stakeholders,
}: CommunicationPlanBuilderProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("channels");
  const [showAddChannelDialog, setShowAddChannelDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [_showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [planActive, setPlanActive] = useState(false);
  const [editingChannel, setEditingChannel] = useState<CommunicationChannel | null>(null);
  const [newChannel, setNewChannel] = useState<Partial<CommunicationChannel>>({
    name: '',
    frequency: 'Weekly',
    audience: '',
    format: '',
    owner: '',
    isActive: true,
    autoTrigger: false,
    nextScheduled: '',
  });
  
  // Fetch users from User Access Management for owner dropdown
  const { data: usersResponse } = useQuery<{ success: boolean; data: UserData[] }>({
    queryKey: ['/api/users'],
  });
  const availableUsers = usersResponse?.data || [];

  // Fetch teams from Team Management for audience dropdown
  const { data: teamsResponse } = useQuery<{ success: boolean; data: TeamData[] }>({
    queryKey: ['/api/teams'],
  });
  const availableTeams = teamsResponse?.data || [];

  // Extract governance roles from project metadata for synchronization
  const projectMetadata = (project as unknown as { metadata?: ProjectMetadata }).metadata || {} as ProjectMetadata;
  const _governanceStructure = projectMetadata.governanceStructure || {} as GovernanceStructure;
  const steeringCommitteeMembers = projectMetadata.steeringCommitteeMembers || ([] as SteeringCommitteeMember[]);
  
  // Build governance-based audiences dynamically from project data
  const governanceAudiences = [
    { id: 'steering-committee', name: 'Steering Committee', members: steeringCommitteeMembers.map((m: SteeringCommitteeMember) => m.displayName).join(', ') || 'Not assigned' },
    { id: 'executive-sponsor', name: 'Executive Sponsor', members: project.sponsor || 'Not assigned' },
    { id: 'project-manager', name: 'Project Manager', members: project.projectManager || 'Not assigned' },
    { id: 'all-stakeholders', name: 'All Stakeholders', members: `${stakeholders.length} stakeholders` },
  ];
  
  // Get governance roles for owner dropdown - prioritize actual assignments
  const governanceOwners = [
    project.projectManager ? { id: 'pm', name: project.projectManager, role: 'Project Manager' } : null,
    project.sponsor ? { id: 'sponsor', name: project.sponsor, role: 'Executive Sponsor' } : null,
    ...steeringCommitteeMembers.map((m: SteeringCommitteeMember) => ({ id: m.userId, name: m.displayName, role: 'Steering Committee' })),
  ].filter(Boolean) as GovernanceOwner[];

  // Default channels synced with Governance Structure
  const defaultChannels: CommunicationChannel[] = [
    { id: 'steering', name: 'Steering Committee Meeting', frequency: 'Monthly', audience: 'Steering Committee', format: 'Formal presentation', owner: project.projectManager || 'Project Manager', isActive: true, autoTrigger: true, nextScheduled: 'Dec 15, 2025' },
    { id: 'sponsor', name: 'Executive Sponsor Briefing', frequency: 'Weekly', audience: 'Executive Sponsor', format: 'Brief report + meeting', owner: project.projectManager || 'Project Manager', isActive: true, autoTrigger: true, nextScheduled: 'Dec 9, 2025' },
    { id: 'team', name: 'Project Team Standup', frequency: 'Daily', audience: 'Project Manager', format: 'Quick sync (15 min)', owner: project.projectManager || 'Project Manager', isActive: true, autoTrigger: false },
    { id: 'stakeholder', name: 'Stakeholder Newsletter', frequency: 'Bi-weekly', audience: 'All Stakeholders', format: 'Email digest', owner: project.projectManager || 'Project Manager', isActive: true, autoTrigger: true, nextScheduled: 'Dec 12, 2025' },
    { id: 'risk', name: 'Risk Review Committee', frequency: 'Bi-weekly', audience: 'Steering Committee', format: 'Risk register review', owner: project.projectManager || 'Project Manager', isActive: true, autoTrigger: true, nextScheduled: 'Dec 10, 2025' },
  ];

  const [channels, setChannels] = useState<CommunicationChannel[]>(defaultChannels);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Fetch saved communication plan from database
  const { data: savedPlanResponse } = useQuery<{ success: boolean; data: SavedCommunicationPlan }>({
    queryKey: ['/api/portfolio/projects', project.id, 'communication-plan'],
  });

  // Load saved plan data when available
  useEffect(() => {
    if (savedPlanResponse?.data && !dataLoaded) {
      const savedPlan = savedPlanResponse.data;
      if (savedPlan.channels && savedPlan.channels.length > 0) {
        setChannels(savedPlan.channels);
      }
      if (savedPlan.autoTriggers && savedPlan.autoTriggers.length > 0) {
        setAutoTriggers(savedPlan.autoTriggers);
      }
      if (savedPlan.isApproved) {
        setPlanActive(true);
      }
      setDataLoaded(true);
    }
  }, [savedPlanResponse?.data, dataLoaded]);

  // Mutation to save communication plan
  const savePlanMutation = useMutation({
    mutationFn: async (data: { channels: CommunicationChannel[]; autoTriggers: AutoTrigger[]; isApproved: boolean }) => {
      return apiRequest('PUT', `/api/portfolio/projects/${project.id}/communication-plan`, data);
    },
    onSuccess: () => {
      toast({
        title: t('projectWorkspace.toast.changesSaved'),
        description: t('projectWorkspace.toast.commPlanSavedDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('projectWorkspace.toast.saveFailed'),
        description: t('projectWorkspace.toast.failedSaveCommPlanDesc'),
        variant: "destructive",
      });
    },
  });

  const [messageTemplates, _setMessageTemplates] = useState<MessageTemplate[]>([
    { 
      id: 'status', 
      type: 'Status Update', 
      name: 'Weekly Status Report',
      icon: BarChart3, 
      color: 'blue', 
      description: 'Regular progress reports',
      subject: 'Project Status Update - {{project_name}} - Week {{week_number}}',
      content: `Dear {{recipient_name}},

Please find below the weekly status update for {{project_name}}:

**Overall Health:** {{health_status}}
**Progress:** {{progress_percentage}}%

**Key Accomplishments This Week:**
{{accomplishments}}

**Planned Activities Next Week:**
{{planned_activities}}

**Risks & Issues:**
{{risks_issues}}

Best regards,
{{sender_name}}
Project Manager`,
      recipients: ['sponsor', 'stakeholders'],
      isActive: true 
    },
    { 
      id: 'milestone', 
      type: 'Milestone Achieved', 
      name: 'Milestone Completion',
      icon: Flag, 
      color: 'emerald', 
      description: 'Celebrate key achievements',
      subject: 'Milestone Achieved - {{milestone_name}} - {{project_name}}',
      content: `Dear Team,

We are pleased to announce that we have successfully completed the following milestone:

**Milestone:** {{milestone_name}}
**Completion Date:** {{completion_date}}
**Project:** {{project_name}}

**Key Deliverables:**
{{deliverables}}

Thank you to everyone who contributed to this achievement.

Best regards,
{{sender_name}}`,
      recipients: ['all'],
      isActive: true 
    },
    { 
      id: 'issue', 
      type: 'Issue Alert', 
      name: 'Critical Issue Notification',
      icon: AlertTriangle, 
      color: 'amber', 
      description: 'Communicate problems early',
      subject: 'URGENT: Issue Alert - {{issue_title}} - {{project_name}}',
      content: `Dear {{recipient_name}},

An issue requiring immediate attention has been identified:

**Issue:** {{issue_title}}
**Priority:** {{priority}}
**Impact:** {{impact_description}}

**Immediate Actions Required:**
{{required_actions}}

**Resolution Timeline:** {{resolution_timeline}}

Please respond by {{response_deadline}}.

Best regards,
{{sender_name}}`,
      recipients: ['sponsor', 'pmo'],
      isActive: true 
    },
    { 
      id: 'decision', 
      type: 'Decision Required', 
      name: 'Decision Request',
      icon: Shield, 
      color: 'purple', 
      description: 'Request stakeholder input',
      subject: 'Decision Required - {{decision_topic}} - {{project_name}}',
      content: `Dear {{recipient_name}},

Your decision is required on the following matter:

**Topic:** {{decision_topic}}
**Project:** {{project_name}}
**Decision Deadline:** {{decision_deadline}}

**Background:**
{{background}}

**Options:**
{{options}}

**Recommendation:**
{{recommendation}}

Please provide your decision by {{decision_deadline}}.

Best regards,
{{sender_name}}`,
      recipients: ['sponsor'],
      isActive: true 
    },
    { 
      id: 'change', 
      type: 'Change Notice', 
      name: 'Change Request Notification',
      icon: RefreshCw, 
      color: 'orange', 
      description: 'Inform about changes',
      subject: 'Change Notice - {{change_title}} - {{project_name}}',
      content: `Dear {{recipient_name}},

Please be informed of the following change to {{project_name}}:

**Change:** {{change_title}}
**Type:** {{change_type}}
**Effective Date:** {{effective_date}}

**Impact:**
{{impact_description}}

**Actions Required:**
{{required_actions}}

If you have questions, please contact {{contact_person}}.

Best regards,
{{sender_name}}`,
      recipients: ['stakeholders'],
      isActive: true 
    },
    { 
      id: 'meeting', 
      type: 'Meeting Invitation', 
      name: 'Project Meeting',
      icon: Calendar, 
      color: 'cyan', 
      description: 'Schedule project meetings',
      subject: 'Meeting Invitation - {{meeting_title}} - {{project_name}}',
      content: `Dear {{recipient_name}},

You are invited to attend the following meeting:

**Meeting:** {{meeting_title}}
**Date:** {{meeting_date}}
**Time:** {{meeting_time}}
**Location:** {{meeting_location}}
**Duration:** {{duration}}

**Agenda:**
{{agenda}}

**Required Preparation:**
{{preparation}}

Please confirm your attendance.

Best regards,
{{sender_name}}`,
      recipients: ['attendees'],
      isActive: true 
    },
  ]);

  const [autoTriggers, setAutoTriggers] = useState<AutoTrigger[]>([
    { id: 't1', name: 'Milestone Completion Alert', triggerType: 'milestone', condition: 'When any milestone is marked complete', templateId: 'milestone', isActive: false },
    { id: 't2', name: 'Phase Gate Approval', triggerType: 'phase_gate', condition: 'When phase gate is approved', templateId: 'status', isActive: false },
    { id: 't3', name: 'High Risk Alert', triggerType: 'risk_threshold', condition: 'When risk level exceeds "High"', templateId: 'issue', isActive: false },
    { id: 't4', name: 'Weekly Status Report', triggerType: 'schedule', condition: 'Every Friday at 4:00 PM', templateId: 'status', isActive: false },
    { id: 't5', name: 'Critical Issue Escalation', triggerType: 'issue_escalation', condition: 'When issue unresolved for 48 hours', templateId: 'issue', isActive: false },
    { id: 't6', name: 'Steering Committee Reminder', triggerType: 'schedule', condition: '3 days before scheduled meeting', templateId: 'meeting', isActive: false },
  ]);

  const sendNotificationMutation = useMutation({
    mutationFn: async (data: { 
      templateType: string; 
      subject: string; 
      content: string; 
      recipients: { email: string; name: string }[];
      isTest?: boolean;
    }) => {
      return apiRequest('POST', '/api/portfolio/communications/send-notification', {
        projectId: project.id,
        ...data,
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.isTest ? t('projectWorkspace.toast.testMessageSent') : t('projectWorkspace.toast.notificationSent'),
        description: t('projectWorkspace.toast.messageSentDesc', { templateType: variables.templateType, count: variables.recipients.length }),
      });
    },
    onError: () => {
      toast({
        title: t('projectWorkspace.toast.sendFailed'),
        description: t('projectWorkspace.toast.failedSendNotificationDesc'),
        variant: "destructive",
      });
    },
  });

  const handleToggleChannel = (channelId: string) => {
    setChannels(prev => prev.map(ch => 
      ch.id === channelId ? { ...ch, isActive: !ch.isActive } : ch
    ));
  };

  // Helper function to save plan - only if data has been loaded
  const saveCurrentPlan = (updatedChannels: CommunicationChannel[], updatedTriggers: AutoTrigger[], approved: boolean) => {
    // Don't save until initial data has loaded to avoid overwriting existing data
    if (!dataLoaded && savedPlanResponse?.data) return;
    savePlanMutation.mutate({ channels: updatedChannels, autoTriggers: updatedTriggers, isApproved: approved });
  };

  const handleAddChannel = () => {
    if (!newChannel.name || !newChannel.audience || !newChannel.owner) {
      toast({
        title: t('projectWorkspace.toast.missingFields'),
        description: t('projectWorkspace.toast.fillChannelFieldsDesc'),
        variant: "destructive",
      });
      return;
    }
    const channel: CommunicationChannel = {
      id: `channel-${Date.now()}`,
      name: newChannel.name,
      frequency: newChannel.frequency || 'Weekly',
      audience: newChannel.audience,
      format: newChannel.format || 'Meeting',
      owner: newChannel.owner,
      isActive: newChannel.isActive ?? true,
      autoTrigger: newChannel.autoTrigger ?? false,
      nextScheduled: newChannel.nextScheduled,
    };
    const updatedChannels = [...channels, channel];
    setChannels(updatedChannels);
    setNewChannel({
      name: '',
      frequency: 'Weekly',
      audience: '',
      format: '',
      owner: '',
      isActive: true,
      autoTrigger: false,
      nextScheduled: '',
    });
    setShowAddChannelDialog(false);
    
    // Save to database
    saveCurrentPlan(updatedChannels, autoTriggers, planActive);
  };

  const handleUpdateChannel = () => {
    if (!editingChannel) return;
    const updatedChannels = channels.map(ch => 
      ch.id === editingChannel.id ? editingChannel : ch
    );
    setChannels(updatedChannels);
    setEditingChannel(null);
    
    // Save to database
    saveCurrentPlan(updatedChannels, autoTriggers, planActive);
  };

  const handleDeleteChannel = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    const updatedChannels = channels.filter(ch => ch.id !== channelId);
    setChannels(updatedChannels);
    toast({
      title: t('projectWorkspace.toast.channelRemoved'),
      description: t('projectWorkspace.toast.channelRemovedDesc', { channelName: channel?.name || 'Channel' }),
    });
    
    // Save to database
    saveCurrentPlan(updatedChannels, autoTriggers, planActive);
  };

  const handleToggleTrigger = (triggerId: string) => {
    const trigger = autoTriggers.find(t => t.id === triggerId);
    const newActiveState = trigger ? !trigger.isActive : false;
    
    // Update state
    const updatedTriggers = autoTriggers.map(tr => 
      tr.id === triggerId ? { ...tr, isActive: newActiveState } : tr
    );
    setAutoTriggers(updatedTriggers);
    
    // Save to database immediately to persist the change
    saveCurrentPlan(channels, updatedTriggers, planActive);
    
    if (trigger) {
      toast({
        title: newActiveState ? t('projectWorkspace.toast.triggerActivated') : t('projectWorkspace.toast.triggerDeactivated'),
        description: newActiveState
          ? t('projectWorkspace.toast.triggerActivatedDesc', { triggerName: trigger.name })
          : t('projectWorkspace.toast.triggerDeactivatedDesc', { triggerName: trigger.name }),
      });
    }
  };

  // Mutation to execute an auto trigger manually
  const executeTriggerMutation = useMutation<ExecuteTriggerResponse, APIError, AutoTrigger>({
    mutationFn: async (trigger: AutoTrigger) => {
      const linkedTemplate = messageTemplates.find(t => t.id === trigger.templateId);
      if (!linkedTemplate) {
        throw new Error("No template linked to this trigger");
      }
      
      const response = await apiRequest('POST', `/api/portfolio/projects/${project.id}/communication-plan/execute-trigger`, {
        triggerId: trigger.id,
        triggerName: trigger.name,
        triggerType: trigger.triggerType,
        templateId: trigger.templateId,
        templateSubject: linkedTemplate.subject,
        templateContent: linkedTemplate.content,
        audienceType: 'all-stakeholders', // Default to all stakeholders
      });
      return response as ExecuteTriggerResponse;
    },
    onSuccess: (data: ExecuteTriggerResponse, trigger) => {
      // Update last triggered time
      setAutoTriggers(prev => prev.map(t => 
        t.id === trigger.id ? { ...t, lastTriggered: new Date().toLocaleDateString() } : t
      ));
      
      const notificationCount = data?.data?.notificationsSent || 0;
      const emailCount = data?.data?.emailsSent || 0;
      toast({
        title: t('projectWorkspace.toast.triggerExecuted'),
        description: t('projectWorkspace.toast.triggerExecutedStatsDesc', { triggerName: trigger.name, notificationCount, emailCount }),
      });
    },
    onError: (error: APIError) => {
      toast({
        title: t('projectWorkspace.toast.triggerFailed'),
        description: error.message || t('projectWorkspace.toast.triggerFailedDesc'),
        variant: "destructive",
      });
    },
  });

  const handleSendTestMessage = (template: MessageTemplate) => {
    const testRecipients = stakeholders
      .filter(s => s.email)
      .slice(0, 3)
      .map(s => ({ email: s.email!, name: s.name }));
    
    if (testRecipients.length === 0) {
      toast({
        title: t('projectWorkspace.toast.noRecipients'),
        description: t('projectWorkspace.toast.noRecipientsDesc'),
        variant: "destructive",
      });
      return;
    }
    
    const personalizedSubject = template.subject
      .replace(/\{\{project_name\}\}/g, project.projectName || 'Project')
      .replace(/\{\{.*?\}\}/g, '[Sample]');
    
    const personalizedContent = template.content
      .replace(/\{\{project_name\}\}/g, project.projectName || 'Project')
      .replace(/\{\{.*?\}\}/g, '[Sample Value]');
    
    sendNotificationMutation.mutate({
      templateType: template.type,
      subject: `[TEST] ${personalizedSubject}`,
      content: personalizedContent,
      recipients: testRecipients,
      isTest: true,
    });
  };

  const getTriggerIcon = (type: AutoTrigger['triggerType']) => {
    switch (type) {
      case 'milestone': return Flag;
      case 'phase_gate': return CheckCircle2;
      case 'risk_threshold': return AlertTriangle;
      case 'schedule': return Clock;
      case 'issue_escalation': return AlertCircle;
      default: return Bell;
    }
  };

  const getTriggerColor = (type: AutoTrigger['triggerType']) => {
    switch (type) {
      case 'milestone': return 'emerald';
      case 'phase_gate': return 'blue';
      case 'risk_threshold': return 'amber';
      case 'schedule': return 'purple';
      case 'issue_escalation': return 'red';
      default: return 'gray';
    }
  };

  const activeTriggersCount = autoTriggers.filter(t => t.isActive).length;
  const activeChannelsCount = channels.filter(c => c.isActive).length;

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30 border border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Communication Plan</h2>
            <p className="text-xs text-muted-foreground">
              Strategic stakeholder engagement and automated communications
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Compact Stats */}
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border">
              <span className="font-semibold text-cyan-600 dark:text-cyan-400">{activeChannelsCount}</span>
              <span className="text-muted-foreground">Channels</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{activeTriggersCount}</span>
              <span className="text-muted-foreground">Triggers</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border">
              <span className="font-semibold text-violet-600 dark:text-violet-400">{messageTemplates.length}</span>
              <span className="text-muted-foreground">Templates</span>
            </div>
          </div>
          
          {/* Plan Toggle */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
            planActive 
              ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' 
              : 'bg-background border-border'
          }`}>
            <span className="text-xs font-medium">
              {planActive ? 'Active' : 'Inactive'}
            </span>
            <Switch
              checked={planActive}
              onCheckedChange={(checked) => {
                setPlanActive(checked);
                savePlanMutation.mutate({ 
                  channels, 
                  autoTriggers: autoTriggers.map(t => ({ ...t, isActive: checked ? t.isActive : false })), 
                  isApproved: checked 
                });
                toast({
                  title: checked ? t('projectWorkspace.toast.planActivated') : t('projectWorkspace.toast.planDeactivated'),
                  description: checked 
                    ? t('projectWorkspace.toast.planActivatedDesc')
                    : t('projectWorkspace.toast.planDeactivatedDesc'),
                });
              }}
              className={`h-5 w-9 ${planActive ? 'data-[state=checked]:bg-emerald-500' : ''}`}
              data-testid="switch-plan-active"
            />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start gap-2 bg-muted/30 p-1.5 rounded-xl border">
          <TabsTrigger value="channels" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-channels">
            <MessageSquare className="w-4 h-4" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-templates">
            <FileText className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="triggers" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-triggers">
            <Zap className="w-4 h-4" />
            Auto Triggers
            {activeTriggersCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">{activeTriggersCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="stakeholders" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-stakeholder-prefs">
            <Users className="w-4 h-4" />
            Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 border-b bg-muted/30">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  Communication Matrix
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Define communication channels for stakeholder engagement</p>
              </div>
              <Button onClick={() => setShowAddChannelDialog(true)} className="gap-2 shadow-sm" data-testid="button-add-channel">
                <Plus className="w-4 h-4" />
                Add Channel
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Status</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Channel</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Frequency</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Audience</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Format</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Owner</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Type</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Next</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {channels.map((channel, index) => (
                      <tr key={channel.id} className={`hover:bg-muted/30 transition-colors ${index % 2 === 0 ? '' : 'bg-muted/10'}`}>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={channel.isActive} 
                              onCheckedChange={() => handleToggleChannel(channel.id)}
                              data-testid={`switch-channel-${channel.id}`}
                            />
                            {channel.isActive && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-medium">{channel.name}</span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="outline" className="font-normal">{channel.frequency}</Badge>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-muted-foreground">{channel.audience}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-muted-foreground text-xs">{channel.format}</span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="secondary" className="font-normal text-xs">{channel.owner}</Badge>
                        </td>
                        <td className="py-4 px-4">
                          {channel.autoTrigger ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1">
                              <Zap className="w-3 h-3" />
                              Auto
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground font-normal">Manual</Badge>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {channel.nextScheduled ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CalendarClock className="w-3.5 h-3.5" />
                              <span>{channel.nextScheduled}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setEditingChannel(channel)}
                            data-testid={`button-edit-channel-${channel.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {channels.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-medium text-muted-foreground">No channels configured</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">Add your first communication channel to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 border-b bg-muted/30">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Message Templates
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Pre-configured communication templates for consistent messaging</p>
              </div>
              <Button className="gap-2 shadow-sm" data-testid="button-add-template">
                <Plus className="w-4 h-4" />
                Create Template
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {messageTemplates.map((template) => {
                  const IconComponent = template.icon;
                  return (
                    <div 
                      key={template.id}
                      className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                        template.isActive 
                          ? `bg-${template.color}-500/10 border-${template.color}-500/30` 
                          : 'bg-muted/40 border-border/50 opacity-60'
                      }`}
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowTemplateDialog(true);
                      }}
                      data-testid={`card-template-${template.id}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className={`w-10 h-10 rounded-lg bg-${template.color}-500/20 flex items-center justify-center`}>
                          <IconComponent className={`w-5 h-5 text-${template.color}-600 dark:text-${template.color}-400`} />
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7"
                            disabled={sendNotificationMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendTestMessage(template);
                            }}
                            data-testid={`button-test-${template.id}`}
                          >
                            {sendNotificationMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-edit-${template.id}`}>
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="font-semibold text-sm mb-1">{template.type}</div>
                      <div className="text-xs text-muted-foreground mb-2">{template.description}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {template.recipients.map((r, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{r}</Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="triggers" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 border-b bg-muted/30">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  Automated Triggers
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Event-based automation rules for proactive communication</p>
              </div>
              <Button onClick={() => setShowTriggerDialog(true)} className="gap-2 shadow-sm" data-testid="button-add-trigger">
                <Plus className="w-4 h-4" />
                Add Trigger
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {autoTriggers.map((trigger) => {
                  const IconComponent = getTriggerIcon(trigger.triggerType);
                  const color = getTriggerColor(trigger.triggerType);
                  const linkedTemplate = messageTemplates.find(t => t.id === trigger.templateId);
                  
                  return (
                    <div 
                      key={trigger.id}
                      className={`p-4 rounded-xl border transition-all ${
                        trigger.isActive
                          ? `bg-${color}-500/10 border-${color}-500/30`
                          : 'bg-muted/40 border-border/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            trigger.isActive 
                              ? `bg-${color}-500/20` 
                              : 'bg-muted'
                          }`}>
                            <IconComponent className={`w-5 h-5 ${
                              trigger.isActive 
                                ? `text-${color}-600 dark:text-${color}-400` 
                                : 'text-muted-foreground'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{trigger.name}</span>
                              {trigger.isActive && (
                                <Badge className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                  Active
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{trigger.condition}</div>
                            {linkedTemplate && (
                              <div className="flex items-center gap-1 mt-1">
                                <Send className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  Sends: {linkedTemplate.type}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {trigger.lastTriggered && (
                            <span className="text-xs text-muted-foreground">
                              Last: {trigger.lastTriggered}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7 text-xs"
                            disabled={!trigger.isActive || executeTriggerMutation.isPending}
                            onClick={() => executeTriggerMutation.mutate(trigger)}
                            data-testid={`button-run-trigger-${trigger.id}`}
                          >
                            {executeTriggerMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                            Run Now
                          </Button>
                          <Switch 
                            checked={trigger.isActive}
                            onCheckedChange={() => handleToggleTrigger(trigger.id)}
                            data-testid={`switch-trigger-${trigger.id}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stakeholders" className="mt-4">
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Stakeholder Communication Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stakeholders.length > 0 ? (
                <div className="space-y-3">
                  {stakeholders.map((stakeholder) => (
                    <div 
                      key={stakeholder.id}
                      className="flex items-center justify-between gap-3 p-4 rounded-xl bg-muted/40 border border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold border-2 border-white/20">
                          {stakeholder.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div className="font-medium">{stakeholder.name}</div>
                          <div className="text-xs text-muted-foreground">{stakeholder.title || stakeholder.role}</div>
                          {stakeholder.email && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{stakeholder.email}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select defaultValue={stakeholder.communicationFrequency || 'weekly'}>
                          <SelectTrigger className="w-32 h-8 text-xs" data-testid={`select-freq-${stakeholder.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Bi-weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="asneeded">As Needed</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`button-email-${stakeholder.id}`}>
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`button-settings-${stakeholder.id}`}>
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                  <div className="text-muted-foreground/70 mb-2">No stakeholders defined yet</div>
                  <p className="text-xs text-muted-foreground/50">Add stakeholders to configure communication preferences</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {selectedTemplate?.type} Template
            </DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Subject Line</Label>
                  <Input 
                    value={selectedTemplate.subject} 
                    className="mt-1 font-mono text-sm"
                    readOnly
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Message Content</Label>
                  <Textarea 
                    value={selectedTemplate.content}
                    className="mt-1 font-mono text-sm min-h-[300px]"
                    readOnly
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Recipients</Label>
                  <div className="flex gap-2 flex-wrap">
                    {selectedTemplate.recipients.map((r, i) => (
                      <Badge key={i} variant="secondary">{r}</Badge>
                    ))}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Template Variables</div>
                  <div className="text-xs text-muted-foreground">
                    Variables like <code className="bg-muted px-1 rounded">{"{{project_name}}"}</code> are automatically replaced when sending.
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Close</Button>
            <Button variant="outline" className="gap-1">
              <Copy className="w-4 h-4" />
              Duplicate
            </Button>
            <Button variant="outline" className="gap-1">
              <Edit className="w-4 h-4" />
              Edit
            </Button>
            <Button 
              className="gap-1"
              onClick={() => {
                if (selectedTemplate) handleSendTestMessage(selectedTemplate);
                setShowTemplateDialog(false);
              }}
            >
              <Send className="w-4 h-4" />
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Channel Dialog */}
      <Dialog open={showAddChannelDialog} onOpenChange={setShowAddChannelDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-600" />
              Add Communication Channel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="channel-name">Channel Name *</Label>
              <Input 
                id="channel-name"
                value={newChannel.name || ''}
                onChange={(e) => setNewChannel(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Weekly Team Sync"
                data-testid="input-channel-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="channel-frequency">Frequency</Label>
                <Select 
                  value={newChannel.frequency} 
                  onValueChange={(value) => setNewChannel(prev => ({ ...prev, frequency: value }))}
                >
                  <SelectTrigger data-testid="select-channel-frequency">
                    <SelectValue placeholder={t('projectWorkspace.communicationPlan.selectFrequency')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Bi-weekly">Bi-weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Ad-hoc">Ad-hoc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel-format">Format</Label>
                <Select 
                  value={newChannel.format || 'Meeting'} 
                  onValueChange={(value) => setNewChannel(prev => ({ ...prev, format: value }))}
                >
                  <SelectTrigger data-testid="select-channel-format">
                    <SelectValue placeholder={t('projectWorkspace.communicationPlan.selectFormat')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Meeting">Meeting</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Report">Report</SelectItem>
                    <SelectItem value="Presentation">Presentation</SelectItem>
                    <SelectItem value="Workshop">Workshop</SelectItem>
                    <SelectItem value="Quick sync (15 min)">Quick sync (15 min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-audience">Audience * (from Governance Structure)</Label>
              <Select 
                value={newChannel.audience || ''} 
                onValueChange={(value) => setNewChannel(prev => ({ ...prev, audience: value }))}
              >
                <SelectTrigger data-testid="select-channel-audience">
                  <SelectValue placeholder={t('projectWorkspace.communicationPlan.selectAudience')} />
                </SelectTrigger>
                <SelectContent>
                  {governanceAudiences.map((audience) => (
                    <SelectItem key={audience.id} value={audience.name}>
                      {audience.name} {audience.members !== 'Not assigned' && audience.members !== `${stakeholders.length} stakeholders` ? `(${audience.members})` : ''}
                    </SelectItem>
                  ))}
                  <SelectItem value="divider-gov" disabled className="text-xs text-muted-foreground">── Teams ──</SelectItem>
                  {availableTeams.map((team) => (
                    <SelectItem key={team.id} value={team.name}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-owner">Owner * (from Governance Structure)</Label>
              <Select 
                value={newChannel.owner || ''} 
                onValueChange={(value) => setNewChannel(prev => ({ ...prev, owner: value }))}
              >
                <SelectTrigger data-testid="select-channel-owner">
                  <SelectValue placeholder={t('projectWorkspace.communicationPlan.selectOwner')} />
                </SelectTrigger>
                <SelectContent>
                  {governanceOwners.map((owner: GovernanceOwner) => (
                    <SelectItem key={owner.id} value={owner.name}>
                      {owner.name} ({owner.role})
                    </SelectItem>
                  ))}
                  <SelectItem value="divider-users" disabled className="text-xs text-muted-foreground">── Other Users ──</SelectItem>
                  {availableUsers.filter(u => !governanceOwners.some((o: GovernanceOwner) => o.name === u.displayName)).map((user) => (
                    <SelectItem key={user.id} value={user.displayName}>
                      {user.displayName} {user.role ? `(${user.role})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-schedule">Next Scheduled</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-channel-schedule"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {newChannel.nextScheduled || "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={newChannel.nextScheduled ? parse(newChannel.nextScheduled, 'MMM d, yyyy', new Date()) : undefined}
                    onSelect={(date) => setNewChannel(prev => ({ 
                      ...prev, 
                      nextScheduled: date ? format(date, 'MMM d, yyyy') : '' 
                    }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch 
                  checked={newChannel.isActive ?? true}
                  onCheckedChange={(checked) => setNewChannel(prev => ({ ...prev, isActive: checked }))}
                  data-testid="switch-channel-active"
                />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={newChannel.autoTrigger ?? false}
                  onCheckedChange={(checked) => setNewChannel(prev => ({ ...prev, autoTrigger: checked }))}
                  data-testid="switch-channel-auto"
                />
                <Label>Auto Trigger</Label>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddChannelDialog(false)}>Cancel</Button>
            <Button 
              className="gap-2"
              onClick={handleAddChannel}
              data-testid="button-confirm-add-channel"
            >
              <Plus className="w-4 h-4" />
              Add Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Channel Dialog */}
      <Dialog open={!!editingChannel} onOpenChange={(open) => !open && setEditingChannel(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-cyan-600" />
              Edit Communication Channel
            </DialogTitle>
          </DialogHeader>
          {editingChannel && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-channel-name">Channel Name</Label>
                <Input 
                  id="edit-channel-name"
                  value={editingChannel.name}
                  onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })}
                  data-testid="input-edit-channel-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-channel-frequency">Frequency</Label>
                  <Select 
                    value={editingChannel.frequency} 
                    onValueChange={(value) => setEditingChannel({ ...editingChannel, frequency: value })}
                  >
                    <SelectTrigger data-testid="select-edit-channel-frequency">
                      <SelectValue placeholder={t('projectWorkspace.communicationPlan.selectFrequency')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Bi-weekly">Bi-weekly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                      <SelectItem value="Ad-hoc">Ad-hoc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-channel-format">Format</Label>
                  <Select 
                    value={editingChannel.format} 
                    onValueChange={(value) => setEditingChannel({ ...editingChannel, format: value })}
                  >
                    <SelectTrigger data-testid="select-edit-channel-format">
                      <SelectValue placeholder={t('projectWorkspace.communicationPlan.selectFormat')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Meeting">Meeting</SelectItem>
                      <SelectItem value="Email">Email</SelectItem>
                      <SelectItem value="Report">Report</SelectItem>
                      <SelectItem value="Presentation">Presentation</SelectItem>
                      <SelectItem value="Workshop">Workshop</SelectItem>
                      <SelectItem value="Quick sync (15 min)">Quick sync (15 min)</SelectItem>
                      <SelectItem value="Formal presentation">Formal presentation</SelectItem>
                      <SelectItem value="Brief report + meeting">Brief report + meeting</SelectItem>
                      <SelectItem value="Email digest">Email digest</SelectItem>
                      <SelectItem value="Working session">Working session</SelectItem>
                      <SelectItem value="Risk register review">Risk register review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-channel-audience">Audience (from Governance Structure)</Label>
                <Select 
                  value={editingChannel.audience} 
                  onValueChange={(value) => setEditingChannel({ ...editingChannel, audience: value })}
                >
                  <SelectTrigger data-testid="select-edit-channel-audience">
                    <SelectValue placeholder={t('projectWorkspace.communicationPlan.selectAudience')} />
                  </SelectTrigger>
                  <SelectContent>
                    {governanceAudiences.map((audience) => (
                      <SelectItem key={audience.id} value={audience.name}>
                        {audience.name} {audience.members !== 'Not assigned' && audience.members !== `${stakeholders.length} stakeholders` ? `(${audience.members})` : ''}
                      </SelectItem>
                    ))}
                    <SelectItem value="divider-gov-edit" disabled className="text-xs text-muted-foreground">── Teams ──</SelectItem>
                    {availableTeams.map((team) => (
                      <SelectItem key={team.id} value={team.name}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-channel-owner">Owner (from Governance Structure)</Label>
                <Select 
                  value={editingChannel.owner} 
                  onValueChange={(value) => setEditingChannel({ ...editingChannel, owner: value })}
                >
                  <SelectTrigger data-testid="select-edit-channel-owner">
                    <SelectValue placeholder={t('projectWorkspace.communicationPlan.selectOwner')} />
                  </SelectTrigger>
                  <SelectContent>
                    {governanceOwners.map((owner: GovernanceOwner) => (
                      <SelectItem key={owner.id} value={owner.name}>
                        {owner.name} ({owner.role})
                      </SelectItem>
                    ))}
                    <SelectItem value="divider-users-edit" disabled className="text-xs text-muted-foreground">── Other Users ──</SelectItem>
                    {availableUsers.filter(u => !governanceOwners.some((o: GovernanceOwner) => o.name === u.displayName)).map((user) => (
                      <SelectItem key={user.id} value={user.displayName}>
                        {user.displayName} {user.role ? `(${user.role})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-channel-schedule">Next Scheduled</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-edit-channel-schedule"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {editingChannel.nextScheduled || "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={editingChannel.nextScheduled ? parse(editingChannel.nextScheduled, 'MMM d, yyyy', new Date()) : undefined}
                      onSelect={(date) => setEditingChannel({ 
                        ...editingChannel, 
                        nextScheduled: date ? format(date, 'MMM d, yyyy') : '' 
                      })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={editingChannel.isActive}
                    onCheckedChange={(checked) => setEditingChannel({ ...editingChannel, isActive: checked })}
                    data-testid="switch-edit-channel-active"
                  />
                  <Label>Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={editingChannel.autoTrigger}
                    onCheckedChange={(checked) => setEditingChannel({ ...editingChannel, autoTrigger: checked })}
                    data-testid="switch-edit-channel-auto"
                  />
                  <Label>Auto Trigger</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button 
              variant="destructive" 
              onClick={() => {
                if (editingChannel) handleDeleteChannel(editingChannel.id);
                setEditingChannel(null);
              }}
              data-testid="button-delete-channel"
            >
              Delete
            </Button>
            <Button variant="outline" onClick={() => setEditingChannel(null)}>Cancel</Button>
            <Button 
              className="gap-2"
              onClick={handleUpdateChannel}
              data-testid="button-confirm-edit-channel"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
