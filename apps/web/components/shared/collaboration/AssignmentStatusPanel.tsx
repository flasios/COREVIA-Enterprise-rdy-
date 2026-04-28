import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { 
  STATUS_CONFIG, 
  ASSIGNMENT_STATUSES, 
  type AssignmentStatus 
} from "@shared/sectionAssignments";
import type { SectionAssignment, User } from "@shared/schema";
import { 
  ChevronDown, 
  MessageSquare, 
  AlertCircle, 
  AlertTriangle, 
  Lightbulb, 
  Calendar,
  Users,
  User as UserIcon,
  Save,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from 'react-i18next';

interface AssignmentStatusPanelProps {
  reportId: string;
  sectionName: string;
  assignment: SectionAssignment & {
    team?: { id: string; name: string; color?: string | null } | null;
    user?: User | null;
    assignedByUser: User;
    statusUpdatedByUser?: User | null;
  };
  currentUserId: string;
}

export default function AssignmentStatusPanel({
  reportId,
  sectionName,
  assignment,
   
  currentUserId: _currentUserId
}: AssignmentStatusPanelProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const [selectedStatus, setSelectedStatus] = useState<AssignmentStatus>(
    assignment.status as AssignmentStatus
  );
  const [notes, setNotes] = useState(assignment.notes || "");
  const [issues, setIssues] = useState(assignment.issues || "");
  const [risks, setRisks] = useState(assignment.risks || "");
  const [challenges, setChallenges] = useState(assignment.challenges || "");

  const getAvailableStatuses = (currentStatus: string): AssignmentStatus[] => {
    const statusOrder = [
      ASSIGNMENT_STATUSES.PENDING_CONFIRMATION,
      ASSIGNMENT_STATUSES.IN_PROGRESS,
      ASSIGNMENT_STATUSES.UNDER_REVIEW,
      ASSIGNMENT_STATUSES.COMPLETED,
    ];
    const currentIndex = statusOrder.indexOf(currentStatus as AssignmentStatus);
    return statusOrder.slice(currentIndex);
  };

  const availableStatuses = getAvailableStatuses(assignment.status);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const updates: { status?: string; notes?: string; issues?: string; risks?: string; challenges?: string } = {};
      
      if (selectedStatus !== assignment.status) {
        updates.status = selectedStatus;
      }
      if (notes !== (assignment.notes || "")) {
        updates.notes = notes;
      }
      if (issues !== (assignment.issues || "")) {
        updates.issues = issues;
      }
      if (risks !== (assignment.risks || "")) {
        updates.risks = risks;
      }
      if (challenges !== (assignment.challenges || "")) {
        updates.challenges = challenges;
      }

      if (Object.keys(updates).length === 0) {
        throw new Error("No changes to save");
      }

      const response = await apiRequest(
        "PATCH",
        `/api/demand-reports/${reportId}/section-assignments/${sectionName}`,
        updates
      );
      return response.json();
    },
    onSuccess: () => {
      // Invalidate with the correct array format that matches the query
      queryClient.invalidateQueries({ 
        queryKey: ["/api/demand-reports", reportId, "section-assignments"] 
      });
      toast({
        title: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>{t('collaboration.assignmentStatus.assignmentUpdated')}</span>
          </div>
        ) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        description: t('collaboration.assignmentStatus.progressSaved'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('collaboration.assignmentStatus.updateFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const hasChanges = selectedStatus !== assignment.status || 
    notes !== (assignment.notes || "") ||
    issues !== (assignment.issues || "") ||
    risks !== (assignment.risks || "") ||
    challenges !== (assignment.challenges || "");

  const handleSave = () => {
    if (hasChanges) {
      updateMutation.mutate();
    }
  };

  const currentStatusConfig = STATUS_CONFIG[assignment.status as AssignmentStatus] || STATUS_CONFIG[ASSIGNMENT_STATUSES.PENDING_CONFIRMATION];
  const StatusIcon = currentStatusConfig?.icon;

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return t('collaboration.assignmentStatus.unknown');
    try {
      return format(new Date(date), "MMM d, yyyy");
    } catch {
      return t('collaboration.assignmentStatus.invalid');
    }
  };

  return (
    <Card 
      className="mb-6 mission-module overflow-hidden border-l-4 shadow-sm"
      style={{
        borderLeftColor: assignment.team?.color || 'hsl(var(--primary))'
      }}
      data-testid={`assignment-panel-${sectionName}`}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Header */}
        <div className="relative bg-gradient-to-r from-accent/30 via-accent/20 to-transparent">
          {/* Blueprint Pattern Overlay */}
          <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              backgroundSize: '30px 30px'
            }}
          />

          <div className="relative px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                {/* Status Badge and Team/User Info */}
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge 
                    variant={currentStatusConfig.variant}
                    className="text-sm px-3 py-1 shadow-sm"
                    data-testid={`badge-current-status-${sectionName}`}
                  >
                    {StatusIcon && <StatusIcon className="h-3.5 w-3.5 mr-1.5" />}
                    {currentStatusConfig.label}
                  </Badge>

                  {assignment.assignedToTeamId && assignment.team && (
                    <Badge 
                      style={{ backgroundColor: assignment.team.color || "#3B82F6" }}
                      className="text-white text-sm px-3 py-1 shadow-sm"
                    >
                      <Users className="h-3.5 w-3.5 mr-1.5" />
                      {assignment.team.name}
                    </Badge>
                  )}

                  {assignment.assignedToUserId && assignment.user && (
                    <Badge 
                      variant="secondary"
                      className="text-sm px-3 py-1 shadow-sm"
                    >
                      <UserIcon className="h-3.5 w-3.5 mr-1.5" />
                      {assignment.user.displayName}
                    </Badge>
                  )}
                </div>

                {/* Assignment Metadata */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{t('collaboration.assignmentStatus.assignedDate', { date: formatDate(assignment.assignedAt) })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5" />
                    <span>{t('collaboration.assignmentStatus.assignedBy', { name: assignment.assignedByUser?.displayName })}</span>
                  </div>
                  {assignment.statusUpdatedAt && (
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{t('collaboration.assignmentStatus.updatedDate', { date: formatDate(assignment.statusUpdatedAt) })}</span>
                    </div>
                  )}
                </div>
              </div>

              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="shrink-0"
                  data-testid={`button-toggle-${sectionName}`}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  <span className="ml-1.5 text-sm">{isOpen ? t('collaboration.assignmentStatus.collapse') : t('collaboration.assignmentStatus.expand')}</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </div>

        {/* Collapsible Content */}
        <CollapsibleContent>
          <CardContent className="px-5 py-5 space-y-5 border-t bg-gradient-to-b from-background to-accent/5">
            {/* Status Update Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="h-1 w-1 rounded-full bg-primary" />
                <span>{t('collaboration.assignmentStatus.updateStatus')}</span>
              </div>

              <div className="flex items-center gap-3">
                <Select
                  value={selectedStatus}
                  onValueChange={(value) => setSelectedStatus(value as AssignmentStatus)}
                  data-testid={`select-status-${sectionName}`}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map((status) => {
                      const config = STATUS_CONFIG[status];
                      const Icon = config.icon;
                      return (
                        <SelectItem key={status} value={status}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{config.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || updateMutation.isPending}
                  className="shrink-0"
                  data-testid={`button-save-status-${sectionName}`}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? t('collaboration.assignmentStatus.saving') : t('collaboration.assignmentStatus.saveChanges')}
                </Button>
              </div>

              {hasChanges && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-md">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{t('collaboration.assignmentStatus.unsavedChanges')}</span>
                </div>
              )}
            </div>

            {/* Documentation Tabs */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="h-1 w-1 rounded-full bg-primary" />
                <span>{t('collaboration.assignmentStatus.documentationProgress')}</span>
              </div>

              <Tabs defaultValue="notes" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-muted/50">
                  <TabsTrigger value="notes" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    <span className="hidden sm:inline">Notes</span>
                  </TabsTrigger>
                  <TabsTrigger value="issues" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                    <span className="hidden sm:inline">Issues</span>
                  </TabsTrigger>
                  <TabsTrigger value="risks" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                    <span className="hidden sm:inline">Risks</span>
                  </TabsTrigger>
                  <TabsTrigger value="challenges" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
                    <span className="hidden sm:inline">Challenges</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="notes" className="mt-4 space-y-2">
                  <div className="relative">
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t('collaboration.assignmentStatus.notesPlaceholder')}
                      className="min-h-[100px] resize-none bg-background/50 border-muted focus:bg-background transition-colors"
                      maxLength={500}
                      data-testid={`textarea-notes-${sectionName}`}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-0.5 rounded">
                      {notes.length}/500
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="issues" className="mt-4 space-y-2">
                  <div className="relative">
                    <Textarea
                      value={issues}
                      onChange={(e) => setIssues(e.target.value)}
                      placeholder={t('collaboration.assignmentStatus.issuesPlaceholder')}
                      className="min-h-[100px] resize-none bg-background/50 border-muted focus:bg-background transition-colors"
                      maxLength={500}
                      data-testid={`textarea-issues-${sectionName}`}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-0.5 rounded">
                      {issues.length}/500
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="risks" className="mt-4 space-y-2">
                  <div className="relative">
                    <Textarea
                      value={risks}
                      onChange={(e) => setRisks(e.target.value)}
                      placeholder={t('collaboration.assignmentStatus.risksPlaceholder')}
                      className="min-h-[100px] resize-none bg-background/50 border-muted focus:bg-background transition-colors"
                      maxLength={500}
                      data-testid={`textarea-risks-${sectionName}`}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-0.5 rounded">
                      {risks.length}/500
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="challenges" className="mt-4 space-y-2">
                  <div className="relative">
                    <Textarea
                      value={challenges}
                      onChange={(e) => setChallenges(e.target.value)}
                      placeholder={t('collaboration.assignmentStatus.challengesPlaceholder')}
                      className="min-h-[100px] resize-none bg-background/50 border-muted focus:bg-background transition-colors"
                      maxLength={500}
                      data-testid={`textarea-challenges-${sectionName}`}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-0.5 rounded">
                      {challenges.length}/500
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
