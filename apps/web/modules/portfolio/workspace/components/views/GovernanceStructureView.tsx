import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  GitBranch as _GitBranch,
  Users,
  ArrowUp,
  Shield,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  Lock as _Lock,
  UserPlus,
  Briefcase,
  AlertCircle,
  Building2,
  Star,
} from "lucide-react";
import type { ProjectData, BusinessCaseData } from "../../types";

interface AvailableUser {
  id: string;
  displayName: string;
  email: string;
  department?: string;
  role?: string;
  currentProjects: number;
  maxProjects: number;
  expertise: string[];
  availability: number;
  certifications?: string[];
}

interface GovernanceStructureViewProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
}

interface GovernanceRole {
  id: string;
  title: string;
  level: number;
  description: string;
  members: string[];
  frequency: string;
  responsibilities: string[];
}

interface EscalationLevel {
  level: string;
  resolver: string;
  timeframe: string;
  examples: string;
}

interface DecisionRow {
  decision: string;
  authority: string;
  approval: string;
}

interface SteeringMemberPayload {
  userId?: string;
  displayName?: string;
  email?: string;
  department?: string;
  role?: string;
}

export function GovernanceStructureView({
  project,
   
  businessCase: _businessCase,
}: GovernanceStructureViewProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isEditMode, setIsEditMode] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningRole, setAssigningRole] = useState<'sponsor' | 'pm' | 'financial_director' | 'steering' | null>(null);
  const [steeringCommitteeMembers, setSteeringCommitteeMembers] = useState<AvailableUser[]>([]);
  
  const charterStatus = (project as any).charterStatus || 'draft'; // eslint-disable-line @typescript-eslint/no-explicit-any
  const isLocked = charterStatus === 'signed' || charterStatus === 'locked' || charterStatus === 'approved';

  // Load persisted steering committee assignments from project metadata
  useEffect(() => {
    const metadata = (project as any).metadata || {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    
    // Load steering committee members
    if (metadata.steeringCommitteeMembers && Array.isArray(metadata.steeringCommitteeMembers)) {
      const members: AvailableUser[] = metadata.steeringCommitteeMembers.map((m: unknown) => {
        const member = (m && typeof m === "object" ? m : {}) as SteeringMemberPayload;
        return {
          id: member.userId || "",
          displayName: member.displayName || "Unknown",
          email: member.email || "",
          department: member.department,
          role: member.role,
          currentProjects: 0,
          maxProjects: 5,
          expertise: [],
          availability: 100,
        };
      });
      setSteeringCommitteeMembers(members);
    }
  }, [project]);

  // Fetch available users for assignment
  const { data: availableUsers = [], isLoading: usersLoading } = useQuery<AvailableUser[]>({
    queryKey: ['/api/users/available-project-managers'],
    enabled: assignDialogOpen,
  });

  // Mutation to assign user to role
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleType }: { userId: string; roleType: 'sponsor' | 'pm' | 'financial_director' }) => {
      const endpointMap = {
        sponsor: `/api/portfolio/projects/${project.id}/assign-sponsor`,
        pm: `/api/portfolio/projects/${project.id}/assign-pm`,
        financial_director: `/api/portfolio/projects/${project.id}/assign-financial-director`,
      };
      const payloadMap = {
        sponsor: { sponsorId: userId },
        pm: { projectManagerId: userId },
        financial_director: { financialDirectorId: userId },
      };
      const response = await apiRequest('PATCH', endpointMap[roleType], payloadMap[roleType]);
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects'] });
      setAssignDialogOpen(false);
      setAssigningRole(null);
      const roleNames = {
        sponsor: 'Executive Sponsor',
        pm: 'Project Manager',
        financial_director: 'Financial Director',
      };
      toast({
        title: t('projectWorkspace.toast.assignmentSuccessful'),
        description: data.message || t('projectWorkspace.toast.roleAssignedDesc', { roleName: roleNames[variables.roleType] }),
      });
    },
    onError: () => {
      toast({
        title: t('projectWorkspace.toast.assignmentFailed'),
        description: t('projectWorkspace.toast.failedAssignRoleDesc'),
        variant: 'destructive',
      });
    },
  });

  const handleAssignClick = (roleType: 'sponsor' | 'pm' | 'financial_director') => {
    if (isLocked) return;
    setAssigningRole(roleType);
    setAssignDialogOpen(true);
  };

  const handleSteeringCommitteeAssignClick = () => {
    if (isLocked) return;
    setAssigningRole('steering');
    setAssignDialogOpen(true);
  };

  // Mutation to add steering committee member
  const assignSteeringMutation = useMutation({
    mutationFn: async ({ user }: { user: AvailableUser }) => {
      // Use dedicated endpoint with COREVIA notification
      const response = await apiRequest('POST', `/api/portfolio/projects/${project.id}/assign-steering-committee`, {
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
        department: user.department,
        userRole: user.role,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Update local state for immediate feedback
      setSteeringCommitteeMembers(prev => [...prev, variables.user]);
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      setAssignDialogOpen(false);
      setAssigningRole(null);
      toast({
        title: t('projectWorkspace.toast.steeringCommitteeUpdated'),
        description: t('projectWorkspace.toast.steeringMemberAddedDesc', { memberName: variables.user.displayName }),
      });
    },
    onError: (error: unknown) => {
      const message =
        typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
          ? error.message
          : t('projectWorkspace.toast.failedAddSteeringMemberDesc');
      toast({
        title: t('projectWorkspace.toast.assignmentFailed'),
        description: message,
        variant: 'destructive',
      });
    },
  });

  const handleUserSelect = (user: AvailableUser) => {
    if (!assigningRole) return;
    
    if (assigningRole === 'steering') {
      // Add to steering committee
      assignSteeringMutation.mutate({ user });
    } else if (assigningRole === 'sponsor' || assigningRole === 'pm' || assigningRole === 'financial_director') {
      assignRoleMutation.mutate({ userId: user.id, roleType: assigningRole });
    }
  };

  // Remove member from steering committee
  const removeSteeringMemberMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const currentMetadata = (project as any).metadata || {}; // eslint-disable-line @typescript-eslint/no-explicit-any
      const existingMembers = currentMetadata.steeringCommitteeMembers || [];
      
      const updatedMembers = existingMembers.filter((m: unknown) => {
        const member = (m && typeof m === "object" ? m : {}) as SteeringMemberPayload;
        return member.userId !== userId;
      });
      
      const response = await apiRequest('PATCH', `/api/portfolio/projects/${project.id}`, {
        metadata: {
          ...currentMetadata,
          steeringCommitteeMembers: updatedMembers,
        },
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      setSteeringCommitteeMembers(prev => prev.filter(m => m.id !== variables.userId));
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      toast({
        title: t('projectWorkspace.toast.memberRemoved'),
        description: t('projectWorkspace.toast.memberRemovedDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('projectWorkspace.toast.removalFailed'),
        description: t('projectWorkspace.toast.failedRemoveMemberDesc'),
        variant: 'destructive',
      });
    },
  });

  const _getAvailabilityColor = (availability: number) => {
    if (availability >= 60) return 'text-emerald-600 dark:text-emerald-400';
    if (availability >= 30) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getAvailabilityBadge = (availability: number) => {
    if (availability >= 60) return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    if (availability >= 30) return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30';
  };

  const defaultGovernanceRoles: GovernanceRole[] = [
    {
      id: 'steering',
      title: 'Steering Committee',
      level: 0,
      description: 'Strategic oversight and major decision approval',
      members: ['Executive Sponsor', 'Financial Director', 'Department Heads', 'PMO Director'],
      frequency: 'Monthly',
      responsibilities: ['Approve major scope changes', 'Resolve escalated issues', 'Strategic alignment decisions', 'Budget oversight and financial governance'],
    },
    {
      id: 'sponsor',
      title: 'Executive Sponsor',
      level: 1,
      description: 'Project champion and ultimate decision authority',
      members: [project.sponsor || 'To be assigned'],
      frequency: 'Weekly check-ins',
      responsibilities: ['Provide resources', 'Remove blockers', 'Stakeholder management'],
    },
    {
      id: 'financial_director',
      title: 'Financial Director',
      level: 1,
      description: 'Budget authority and financial governance oversight',
      members: [(project as any).financialDirector || 'To be assigned'], // eslint-disable-line @typescript-eslint/no-explicit-any
      frequency: 'Weekly check-ins',
      responsibilities: ['Approve budget variance 10-20%', 'Financial oversight', 'Budget reallocation', 'Sign project charter'],
    },
    {
      id: 'pm',
      title: 'Project Manager',
      level: 2,
      description: 'Day-to-day project leadership and delivery',
      members: [project.projectManager || 'To be assigned'],
      frequency: 'Daily',
      responsibilities: ['Plan and execute project', 'Manage team', 'Report progress', 'Risk management'],
    },
  ];

  const defaultEscalationPath: EscalationLevel[] = [
    { level: 'Team Level', resolver: 'Project Manager', timeframe: '24 hours', examples: 'Task delays, resource conflicts' },
    { level: 'Project Level', resolver: 'Project Sponsor', timeframe: '48 hours', examples: 'Budget issues, scope conflicts' },
    { level: 'Executive Level', resolver: 'Steering Committee', timeframe: '1 week', examples: 'Strategic changes, major risks' },
  ];

  const defaultDecisionMatrix: DecisionRow[] = [
    { decision: 'Scope Changes < 5%', authority: 'Project Manager', approval: 'Direct' },
    { decision: 'Scope Changes 5-15%', authority: 'Project Sponsor', approval: 'Written approval' },
    { decision: 'Scope Changes > 15%', authority: 'Steering Committee', approval: 'Board meeting' },
    { decision: 'Budget Variance < 10%', authority: 'Project Manager', approval: 'Direct' },
    { decision: 'Budget Variance 10-20%', authority: 'Financial Director', approval: 'Written approval' },
    { decision: 'Budget Variance > 20%', authority: 'Steering Committee', approval: 'Board meeting' },
    { decision: 'Timeline Extension < 2 weeks', authority: 'Project Sponsor', approval: 'Written approval' },
    { decision: 'Timeline Extension > 2 weeks', authority: 'Steering Committee', approval: 'Board meeting' },
  ];

  // Load from project metadata if available
  const metadata = (project as any).metadata || {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  const savedGovernance = metadata.governanceStructure;

  // Get initial data from saved or defaults
  const getInitialRoles = () => {
    // If there's saved governance, update sponsor/PM/FD names from current project data
    if (savedGovernance?.roles) {
      return savedGovernance.roles.map((role: GovernanceRole) => {
        if (role.id === 'sponsor') {
          return { ...role, members: [project.sponsor || 'To be assigned'] };
        }
        if (role.id === 'pm') {
          return { ...role, members: [project.projectManager || 'To be assigned'] };
        }
        if (role.id === 'financial_director') {
          return { ...role, members: [(project as any).financialDirector || 'To be assigned'] }; // eslint-disable-line @typescript-eslint/no-explicit-any
        }
        return role;
      });
    }
    return defaultGovernanceRoles;
  };
  const getInitialEscalation = () => savedGovernance?.escalationPath || defaultEscalationPath;
  const getInitialDecision = () => savedGovernance?.decisionMatrix || defaultDecisionMatrix;

  const [governanceRoles, setGovernanceRoles] = useState<GovernanceRole[]>(getInitialRoles());
  const [escalationPath, setEscalationPath] = useState<EscalationLevel[]>(getInitialEscalation());
  const [decisionMatrix, setDecisionMatrix] = useState<DecisionRow[]>(getInitialDecision());

  // Update governance roles when project sponsor/PM/FD changes
  useEffect(() => {
    setGovernanceRoles(prev => prev.map(role => {
      if (role.id === 'sponsor') {
        return { ...role, members: [project.sponsor || 'To be assigned'] };
      }
      if (role.id === 'pm') {
        return { ...role, members: [project.projectManager || 'To be assigned'] };
      }
      if (role.id === 'financial_director') {
        return { ...role, members: [(project as any).financialDirector || 'To be assigned'] }; // eslint-disable-line @typescript-eslint/no-explicit-any
      }
      return role;
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.sponsor, project.projectManager, (project as any).financialDirector]); // eslint-disable-line @typescript-eslint/no-explicit-any

  // Cancel handler to restore from saved data
  const handleCancel = () => {
    setGovernanceRoles(getInitialRoles());
    setEscalationPath(getInitialEscalation());
    setDecisionMatrix(getInitialDecision());
    setIsEditMode(false);
  };

  // Validation before save
  const validateGovernanceData = (): string | null => {
    if (!governanceRoles || governanceRoles.length === 0) {
      return 'At least one governance role is required.';
    }
    if (!escalationPath || escalationPath.length === 0) {
      return 'At least one escalation level is required.';
    }
    if (!decisionMatrix || decisionMatrix.length === 0) {
      return 'At least one decision row is required.';
    }
    // Check for empty role titles
    const emptyRole = governanceRoles.find(r => !r.title.trim());
    if (emptyRole) {
      return 'All governance roles must have a title.';
    }
    return null;
  };

  const handleSave = () => {
    const error = validateGovernanceData();
    if (error) {
      toast({ title: t('projectWorkspace.toast.validationError'), description: error, variant: 'destructive' });
      return;
    }
    saveGovernanceMutation.mutate();
  };

  const saveGovernanceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('PATCH', `/api/portfolio/projects/${project.id}/governance`, {
        roles: governanceRoles,
        escalationPath,
        decisionMatrix,
      });
      return response.json();
    },
    onSuccess: (response: unknown) => {
      // Refresh local state from the response if available
      const updatedGovernance =
        typeof response === "object" &&
        response !== null &&
        "data" in response &&
        typeof (response as { data?: { metadata?: { governanceStructure?: unknown } } }).data?.metadata?.governanceStructure === "object"
          ? (response as { data: { metadata: { governanceStructure: { roles?: GovernanceRole[]; escalationPath?: EscalationLevel[]; decisionMatrix?: DecisionRow[] } } } }).data.metadata.governanceStructure
          : null;
      if (updatedGovernance) {
        setGovernanceRoles(updatedGovernance.roles || governanceRoles);
        setEscalationPath(updatedGovernance.escalationPath || escalationPath);
        setDecisionMatrix(updatedGovernance.decisionMatrix || decisionMatrix);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      setIsEditMode(false);
      toast({ 
        title: t('projectWorkspace.toast.governanceSaved'), 
        description: t('projectWorkspace.toast.governanceSavedDesc') 
      });
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.error'), description: t('projectWorkspace.toast.failedSaveGovernanceDesc'), variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Governance Hierarchy
              {isEditMode && <Badge className="ml-2 bg-blue-500/20 text-blue-700 dark:text-blue-400">Editing</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {governanceRoles.map((role, i) => (
                <div key={role.id} className="relative">
                  {i > 0 && (
                    <div className="absolute left-6 -top-4 w-0.5 h-4 bg-gradient-to-b from-transparent to-border" />
                  )}
                  <div className={`p-4 rounded-lg border-2 transition-all ${
                    role.level === 0 ? 'bg-amber-900/20 border-amber-500/40' :
                    role.level === 1 ? 'bg-purple-900/20 border-purple-500/40' :
                    role.level === 2 ? 'bg-blue-900/20 border-blue-500/40' :
                    'bg-muted/40 border-border/40'
                  }`} style={{ marginLeft: `${role.level * 12}px` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{role.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{role.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{role.frequency}</Badge>
                        {role.id === 'steering' && !isLocked && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSteeringCommitteeAssignClick}
                            className="h-6 px-2 text-xs gap-1"
                            data-testid="button-assign-steering"
                          >
                            <UserPlus className="w-3 h-3" />
                            Add Member
                          </Button>
                        )}
                        {(role.id === 'sponsor' || role.id === 'pm' || role.id === 'financial_director') && !isLocked && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAssignClick(role.id as 'sponsor' | 'pm' | 'financial_director')}
                            className="h-6 px-2 text-xs gap-1"
                            data-testid={`button-assign-${role.id}`}
                          >
                            <UserPlus className="w-3 h-3" />
                            Assign
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {role.id === 'steering' ? (
                      <div className="mt-3 space-y-2">
                        {steeringCommitteeMembers.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {steeringCommitteeMembers.map((member, j) => (
                              <div
                                key={j}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 group"
                              >
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-[9px] bg-amber-600 text-white">
                                    {member.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                  {member.displayName}
                                </span>
                                {!isLocked && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeSteeringMemberMutation.mutate({ userId: member.id });
                                    }}
                                    className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600"
                                    data-testid={`button-remove-steering-${j}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {steeringCommitteeMembers.length === 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {role.members.map((member, j) => (
                              <Badge key={j} variant="secondary" className="text-xs opacity-60">{member}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (role.id === 'sponsor' || role.id === 'pm' || role.id === 'financial_director') ? (
                      <div className="mt-3">
                        {(() => {
                          const assignedName = role.id === 'sponsor' 
                            ? project.sponsor 
                            : role.id === 'pm' 
                              ? project.projectManager 
                              : (project as any).financialDirector; // eslint-disable-line @typescript-eslint/no-explicit-any
                          const colorScheme = role.id === 'financial_director' 
                            ? { bg: 'bg-amber-500/10', border: 'border-amber-500/30', avatar: 'bg-amber-600', text: 'text-amber-700 dark:text-amber-400', subtext: 'text-amber-600/70 dark:text-amber-400/70' }
                            : { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', avatar: 'bg-emerald-600', text: 'text-emerald-700 dark:text-emerald-400', subtext: 'text-emerald-600/70 dark:text-emerald-400/70' };
                          if (assignedName) {
                            return (
                              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colorScheme.bg} ${colorScheme.border} w-fit`}>
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className={`text-[10px] ${colorScheme.avatar} text-white font-medium`}>
                                    {assignedName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className={`text-xs font-semibold ${colorScheme.text}`}>
                                    {assignedName}
                                  </span>
                                  <span className={`text-[10px] ${colorScheme.subtext}`}>
                                    Assigned
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <Badge variant="secondary" className="text-xs opacity-60">
                              To be assigned
                            </Badge>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {role.members.map((member, j) => (
                          <Badge key={j} variant="secondary" className="text-xs">{member}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Escalation Path
              {isEditMode && <Badge className="ml-2 bg-blue-500/20 text-blue-700 dark:text-blue-400">Editing</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {escalationPath.map((level, i) => (
                <div key={i} className="relative">
                  {i < escalationPath.length - 1 && (
                    <div className="absolute left-5 top-full w-0.5 h-3 bg-gradient-to-b from-amber-500/50 to-transparent" />
                  )}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      i === 0 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                      i === 1 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                      'bg-red-500/20 text-red-600 dark:text-red-400'
                    }`}>
                      L{i + 1}
                    </div>
                    {isEditMode ? (
                      <div className="flex-1 space-y-2">
                        <Input
                          value={level.level}
                          onChange={(e) => {
                            const newPath = [...escalationPath];
                            newPath[i]!.level = e.target.value;
                            setEscalationPath(newPath);
                          }}
                          placeholder={t('projectWorkspace.governance.levelName')}
                          className="text-sm"
                          data-testid={`input-escalation-level-${i}`}
                        />
                        <Input
                          value={level.resolver}
                          onChange={(e) => {
                            const newPath = [...escalationPath];
                            newPath[i]!.resolver = e.target.value;
                            setEscalationPath(newPath);
                          }}
                          placeholder={t('projectWorkspace.governance.resolver')}
                          className="text-xs"
                          data-testid={`input-escalation-resolver-${i}`}
                        />
                        <Input
                          value={level.examples}
                          onChange={(e) => {
                            const newPath = [...escalationPath];
                            newPath[i]!.examples = e.target.value;
                            setEscalationPath(newPath);
                          }}
                          placeholder={t('projectWorkspace.governance.examples')}
                          className="text-xs"
                          data-testid={`input-escalation-examples-${i}`}
                        />
                      </div>
                    ) : (
                      <div className="flex-1">
                        <div className="font-medium text-sm">{level.level}</div>
                        <div className="text-xs text-muted-foreground">Resolver: {level.resolver}</div>
                        <div className="text-xs text-muted-foreground/70 mt-1">Examples: {level.examples}</div>
                      </div>
                    )}
                    <Badge variant="outline" className="text-xs">{level.timeframe}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Decision Authority Matrix
            {isEditMode && <Badge className="ml-2 bg-blue-500/20 text-blue-700 dark:text-blue-400">Editing</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Decision Type</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Authority</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Approval Process</th>
                  {isEditMode && <th className="w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {decisionMatrix.map((row, i) => (
                  <tr key={i} className="border-b border-border">
                    {isEditMode ? (
                      <>
                        <td className="py-2 px-3">
                          <Input
                            value={row.decision}
                            onChange={(e) => {
                              const newMatrix = [...decisionMatrix];
                              newMatrix[i]!.decision = e.target.value;
                              setDecisionMatrix(newMatrix);
                            }}
                            className="text-sm"
                            data-testid={`input-decision-${i}`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            value={row.authority}
                            onChange={(e) => {
                              const newMatrix = [...decisionMatrix];
                              newMatrix[i]!.authority = e.target.value;
                              setDecisionMatrix(newMatrix);
                            }}
                            className="text-sm"
                            data-testid={`input-authority-${i}`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            value={row.approval}
                            onChange={(e) => {
                              const newMatrix = [...decisionMatrix];
                              newMatrix[i]!.approval = e.target.value;
                              setDecisionMatrix(newMatrix);
                            }}
                            className="text-sm"
                            data-testid={`input-approval-${i}`}
                          />
                        </td>
                        <td className="py-2 px-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setDecisionMatrix(decisionMatrix.filter((_, idx) => idx !== i));
                            }}
                            data-testid={`button-remove-decision-${i}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 px-3">{row.decision}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className={`text-xs ${
                            row.authority === 'Project Manager' ? 'text-blue-600 dark:text-blue-400 border-blue-500/30' :
                            row.authority === 'Project Sponsor' ? 'text-purple-600 dark:text-purple-400 border-purple-500/30' :
                            'text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}>
                            {row.authority}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{row.approval}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {isEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDecisionMatrix([...decisionMatrix, { decision: '', authority: '', approval: '' }])}
                className="mt-3 gap-2"
                data-testid="button-add-decision-row"
              >
                <Plus className="w-4 h-4" />
                Add Decision Row
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit/Save/Cancel Actions - Below Escalation Path */}
      {!isLocked && (
        <div className="flex items-center justify-end gap-2 pt-2">
          {!isEditMode ? (
            <Button 
              onClick={() => setIsEditMode(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              data-testid="button-edit-governance"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Governance Structure
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleCancel}
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                data-testid="button-cancel-governance"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saveGovernanceMutation.isPending}
                size="sm"
                className="gap-1.5 h-8 text-xs"
                data-testid="button-save-governance"
              >
                <Save className="w-3.5 h-3.5" />
                {saveGovernanceMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </div>
      )}

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              {assigningRole === 'steering' ? 'Add Steering Committee Member' : 
               `Assign ${assigningRole === 'sponsor' ? 'Executive Sponsor' : assigningRole === 'pm' ? 'Project Manager' : 'Financial Director'}`}
            </DialogTitle>
            <DialogDescription>
              {assigningRole === 'steering' 
                ? 'Select a team member to add to the Steering Committee. Members provide strategic oversight and major decision approval.'
                : assigningRole === 'financial_director'
                  ? 'Select a Financial Director for budget authority and financial governance oversight. They will sign the project charter and approve budget variances.'
                  : `Select a team member to assign as the ${assigningRole === 'sponsor' ? 'Executive Sponsor' : 'Project Manager'} for this project. Recommendations are based on availability, expertise, and current workload.`
              }
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            {usersLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : availableUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('projectWorkspace.governance.noAvailableTeamMembers')}</p>
              </div>
            ) : (
              <div className="space-y-3 pr-4">
                {availableUsers
                  .sort((a, b) => b.availability - a.availability)
                  .map((user) => (
                    <div
                      key={user.id}
                      className="p-4 rounded-lg border border-border/50 bg-muted/30 hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer group"
                      onClick={() => handleUserSelect(user)}
                      data-testid={`user-card-${user.id}`}
                    >
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 border-2 border-border">
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-medium">
                            {user.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">
                              {user.displayName}
                            </h4>
                            <Badge className={`text-[10px] ${getAvailabilityBadge(user.availability)}`}>
                              {user.availability}% Available
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                            {user.role && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="w-3 h-3" />
                                {user.role}
                              </span>
                            )}
                            {user.department && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {user.department}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Briefcase className="w-3 h-3 text-muted-foreground" />
                              <span className={user.currentProjects >= user.maxProjects ? 'text-red-500' : 'text-muted-foreground'}>
                                {user.currentProjects}/{user.maxProjects} Projects
                              </span>
                            </div>
                            <div className="flex-1">
                              <Progress 
                                value={user.availability} 
                                className="h-1.5"
                              />
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            {user.expertise?.slice(0, 4).map((exp, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                                {exp}
                              </Badge>
                            ))}
                            {user.certifications?.slice(0, 2).map((cert, i) => (
                              <Badge key={`cert-${i}`} className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                <Star className="w-2.5 h-2.5 mr-0.5" />
                                {cert}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <Button
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={assignRoleMutation.isPending || assignSteeringMutation.isPending}
                          data-testid={`button-select-user-${user.id}`}
                        >
                          {(assignRoleMutation.isPending || assignSteeringMutation.isPending) ? 'Assigning...' : 'Select'}
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
