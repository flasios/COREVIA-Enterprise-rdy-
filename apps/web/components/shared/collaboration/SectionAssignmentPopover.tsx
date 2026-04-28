import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Users, User, X, Settings, CheckCircle, AlertTriangle, Info, Calendar, Sparkles, UserCog, PanelLeftClose, ClipboardCheck, Copy, Check, Activity, TrendingUp, ChevronRight, Clock } from "lucide-react";
import { STATUS_CONFIG, ASSIGNMENT_STATUSES, assignSectionSchema, type AssignSectionFormData, type AssignmentStatus } from "@shared/sectionAssignments";
import type { Team, User as UserType, SectionAssignment } from "@shared/schema";
import { format, differenceInDays } from "date-fns";
import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";

const STATUS_ORDER: AssignmentStatus[] = [
  ASSIGNMENT_STATUSES.PENDING_CONFIRMATION,
  ASSIGNMENT_STATUSES.IN_PROGRESS,
  ASSIGNMENT_STATUSES.UNDER_REVIEW,
  ASSIGNMENT_STATUSES.COMPLETED,
];

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
}

const stepStyles: Record<AssignmentStatus, { ring: string; bg: string; text: string }> = {
  [ASSIGNMENT_STATUSES.PENDING_CONFIRMATION]: { ring: "border-amber-400", bg: "bg-amber-400", text: "text-amber-600 dark:text-amber-400" },
  [ASSIGNMENT_STATUSES.IN_PROGRESS]: { ring: "border-blue-500", bg: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  [ASSIGNMENT_STATUSES.UNDER_REVIEW]: { ring: "border-purple-500", bg: "bg-purple-500", text: "text-purple-600 dark:text-purple-400" },
  [ASSIGNMENT_STATUSES.COMPLETED]: { ring: "border-green-500", bg: "bg-green-500", text: "text-green-600 dark:text-green-400" },
};

interface SectionAssignmentPopoverProps {
  reportId: string;
  sectionName: string;
  sectionLabel: string;
}

export default function SectionAssignmentPopover({ reportId, sectionName, sectionLabel }: SectionAssignmentPopoverProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [notesCopied, setNotesCopied] = useState(false);

  // Fetch teams
  const { data: teamsResponse, isLoading: teamsLoading } = useQuery<{ success: boolean; data: Team[] }>({
    queryKey: ["/api/teams"],
    enabled: open,
  });

  // Fetch users
  const { data: usersResponse, isLoading: usersLoading } = useQuery<{ success: boolean; data: UserType[] }>({
    queryKey: ["/api/users"],
    enabled: open,
  });

  // Fetch assignment for this specific section
  const { data: assignmentResponse, isLoading: assignmentLoading } = useQuery<{
    success: boolean;
    data: Array<SectionAssignment & { team?: Team | null; user?: UserType | null; assignedByUser: UserType }>;
  }>({
    queryKey: ["/api/demand-reports", reportId, "section-assignments"],
    enabled: open,
  });

  const teams = teamsResponse?.data ?? [];
  const users = usersResponse?.data ?? [];
  const allAssignments = assignmentResponse?.data ?? [];
  const assignment = allAssignments.find((a) => a.sectionName === sectionName);

  // ── Intelligence metrics ──────────────────────────────────────────
  const daysActive = assignment ? differenceInDays(new Date(), new Date(assignment.assignedAt)) : 0;
  const isOverdue = assignment && daysActive > 7 && assignment.status === ASSIGNMENT_STATUSES.PENDING_CONFIRMATION;
  const workloadCount = assignment
    ? allAssignments.filter((a) => {
        if (assignment.assignedToTeamId) return a.assignedToTeamId === assignment.assignedToTeamId;
        if (assignment.assignedToUserId) return a.assignedToUserId === assignment.assignedToUserId;
        return false;
      }).length
    : 0;
  const totalAssigned = allAssignments.length;

  // Form for assignment
  const form = useForm<AssignSectionFormData>({
    resolver: zodResolver(assignSectionSchema),
    defaultValues: {
      sectionName,
      assignmentType: assignment?.assignedToTeamId ? "team" : "user",
      assignedToTeamId: assignment?.assignedToTeamId || null,
      assignedToUserId: assignment?.assignedToUserId || null,
      notes: assignment?.notes || "",
      status: (assignment?.status as AssignmentStatus) || ASSIGNMENT_STATUSES.PENDING_CONFIRMATION,
    },
  });

  const assignmentType = form.watch("assignmentType");

  // Update form when assignment data loads
  useEffect(() => {
    if (assignment) {
      form.reset({
        sectionName,
        assignmentType: assignment.assignedToTeamId ? "team" : "user",
        assignedToTeamId: assignment.assignedToTeamId || null,
        assignedToUserId: assignment.assignedToUserId || null,
        notes: assignment.notes || "",
        status: (assignment.status as AssignmentStatus) || ASSIGNMENT_STATUSES.PENDING_CONFIRMATION,
      });
    }
  }, [assignment, form, sectionName]);

  // Assign/update mutation
  const assignMutation = useMutation({
    mutationFn: async (data: AssignSectionFormData) => {
      const payload = {
        sectionName: data.sectionName,
        assignedToTeamId: data.assignmentType === "team" ? data.assignedToTeamId : null,
        assignedToUserId: data.assignmentType === "user" ? data.assignedToUserId : null,
        notes: data.notes || undefined,
        status: data.status,
      };
      const response = await apiRequest("POST", `/api/demand-reports/${reportId}/section-assignments`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", reportId, "section-assignments"] });
      toast({
        title: String(t('collaboration.sectionAssignment.sectionAssigned')),
        description: t('collaboration.sectionAssignment.assignedSuccessfully', { section: sectionLabel }),
      });
      setIsEditingExisting(false);
      setOpen(false);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('collaboration.sectionAssignment.assignmentFailed'),
        description: error.message || t('collaboration.sectionAssignment.failedToAssign'),
        variant: "destructive",
      });
    },
  });

  // Remove assignment mutation
  const removeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/demand-reports/${reportId}/section-assignments/${sectionName}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", reportId, "section-assignments"] });
      toast({
        title: t('collaboration.sectionAssignment.assignmentRemoved'),
        description: t('collaboration.sectionAssignment.assignmentRemovedDesc', { section: sectionLabel }),
      });
      setDeleteDialogOpen(false);
      setOpen(false);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('collaboration.sectionAssignment.removalFailed'),
        description: error.message || t('collaboration.sectionAssignment.failedToRemove'),
        variant: "destructive",
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiRequest("PATCH", `/api/demand-reports/${reportId}/section-assignments/${sectionName}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", reportId, "section-assignments"] });
      toast({
        title: t('collaboration.sectionAssignment.statusUpdated'),
        description: t('collaboration.sectionAssignment.statusUpdatedDesc'),
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('collaboration.sectionAssignment.updateFailed'),
        description: error.message || t('collaboration.sectionAssignment.failedToUpdate'),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AssignSectionFormData) => {
    assignMutation.mutate(data);
  };

  const handleCopyNotes = () => {
    if (assignment?.notes) {
      navigator.clipboard.writeText(assignment.notes);
      setNotesCopied(true);
      setTimeout(() => setNotesCopied(false), 2000);
    }
  };

  const statusConfig = assignment ? STATUS_CONFIG[assignment.status as AssignmentStatus] : null;
  const currentStatusIdx = assignment ? STATUS_ORDER.indexOf(assignment.status as AssignmentStatus) : -1;

  // Derive the assignee display label for the KPI strip
  const assigneeName = (() => {
    if (!assignment) return null;
    if (assignment.assignedToTeamId && assignment.team) return assignment.team.name;
    if (assignment.assignedToUserId && assignment.user) return assignment.user.displayName;
    return null;
  })();
  const assigneeColor = assignment?.assignedToTeamId ? (assignment.team?.color ?? "hsl(var(--primary))") : "hsl(var(--primary))";
  const assigneeLabel = assigneeName ?? t('collaboration.sectionAssignment.notAssigned');
  const assigneeKind = assignment?.assignedToTeamId ? 'team' : assignment?.assignedToUserId ? 'user' : 'none';

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="hover-elevate"
            data-testid={`button-assign-${sectionName}`}
          >
            <UserCog className="h-4 w-4 mr-2" />
            {assignment ? t('collaboration.sectionAssignment.manageAssignment') : t('collaboration.sectionAssignment.assignSection')}
          </Button>
        </SheetTrigger>
        <SheetContent
          className="flex w-[480px] flex-col p-0 sm:w-[640px] sm:max-w-none"
          side="right"
          data-testid={`panel-assign-${sectionName}`}
        >
          {/* Header — professional smart-panel style (matches Version Control panel) */}
          <div className="border-b border-border/50 bg-muted/20 px-6 py-5">
            <SheetHeader className="text-left">
              <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary/40 shadow-sm shrink-0">
                  <PanelLeftClose className="h-5 w-5 text-primary-foreground" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {t('collaboration.sectionAssignment.sectionManagement')}
                  </span>
                  <span>{sectionLabel}</span>
                </span>
              </SheetTitle>
              <SheetDescription className="text-xs">
                {t('collaboration.sectionAssignment.dialogDescription')}
              </SheetDescription>
            </SheetHeader>

            {/* 4-Column Intelligence KPI Strip */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              <div className="command-dock rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  {t('collaboration.sectionAssignment.kpiAssignee')}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold truncate">
                  {assigneeKind === 'team' && <Users className="h-3 w-3 text-primary shrink-0" />}
                  {assigneeKind === 'user' && <User className="h-3 w-3 text-primary shrink-0" />}
                  {assigneeKind === 'none' && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                  <span className="truncate text-xs">{assigneeLabel}</span>
                </p>
              </div>
              <div className="command-dock rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  {t('collaboration.sectionAssignment.kpiStatus')}
                </p>
                <p className={cn("mt-0.5 text-xs font-semibold truncate", statusConfig ? stepStyles[assignment!.status as AssignmentStatus].text : "text-muted-foreground")}>
                  {statusConfig?.label ?? t('collaboration.sectionAssignment.kpiStatusNone')}
                </p>
              </div>
              <div className="command-dock rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  {t('collaboration.sectionAssignment.daysActive')}
                </p>
                <p className={cn("mt-0.5 text-xs font-semibold", isOverdue ? "text-destructive" : "text-foreground")}>
                  {assignment ? (
                    <span className="flex items-center gap-1">
                      {isOverdue && <AlertTriangle className="h-3 w-3" />}
                      {daysActive}d
                    </span>
                  ) : "—"}
                </p>
              </div>
              <div className="command-dock rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  {t('collaboration.sectionAssignment.sectionLoad')}
                </p>
                <p className="mt-0.5 text-xs font-semibold flex items-center gap-1">
                  {assignment && workloadCount > 0 ? (
                    <><Activity className="h-3 w-3 text-primary shrink-0" /><span>{workloadCount}/{totalAssigned || "?"}</span></>
                  ) : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* ═══ STATUS WORKFLOW RAIL ═══════════════════════════════════ */}
          {assignment && (
            <div className="px-6 py-4 border-b border-border/40 bg-muted/10">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" />
                {t('collaboration.sectionAssignment.statusRail')}
              </p>
              <TooltipProvider>
                <div className="flex items-center">
                  {STATUS_ORDER.map((status, idx) => {
                    const config = STATUS_CONFIG[status];
                    const Icon = config.icon;
                    const styles = stepStyles[status];
                    const isDone = idx < currentStatusIdx;
                    const isCurrent = idx === currentStatusIdx;
                    return (
                      <div key={status} className="flex items-center flex-1 min-w-0">
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className={cn(
                                  "h-7 w-7 rounded-full flex items-center justify-center transition-all border-2",
                                  (isDone || isCurrent) && `${styles.bg} ${styles.ring} text-white`,
                                  isCurrent && "ring-2 ring-offset-1 ring-offset-background",
                                  !isDone && !isCurrent && "border-muted-foreground/25 bg-muted text-muted-foreground hover:border-primary/40"
                                )}
                                onClick={() => !isCurrent && updateStatusMutation.mutate(status)}
                                disabled={updateStatusMutation.isPending || isCurrent}
                                aria-label={config.ariaLabel}
                              >
                                {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3 w-3" />}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs max-w-[140px] text-center">
                              <p className="font-semibold">{config.label}</p>
                              <p className="text-muted-foreground">{config.description}</p>
                            </TooltipContent>
                          </Tooltip>
                          <span className={cn("text-[9px] uppercase tracking-wide font-medium text-center leading-tight max-w-[55px] truncate", isCurrent ? styles.text : "text-muted-foreground")}>
                            {config.label}
                          </span>
                        </div>
                        {idx < STATUS_ORDER.length - 1 && (
                          <div className={cn("h-[2px] flex-1 mx-1 rounded-full transition-colors mb-4", isDone ? styles.bg : "bg-muted-foreground/20")} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </TooltipProvider>
            </div>
          )}

          {/* Content — scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
              {assignment && !isEditingExisting
                ? t('collaboration.sectionAssignment.currentAssignmentHeading', { defaultValue: 'Current assignment' })
                : t('collaboration.sectionAssignment.assignToHeading', { defaultValue: 'Assignment details' })}
            </div>
            {(() => {
              if (assignmentLoading || teamsLoading || usersLoading) {
                return (
                  <div className="text-sm text-muted-foreground py-8 text-center flex items-center justify-center gap-2">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    {t('collaboration.sectionAssignment.loading')}
                  </div>
                );
              }
              if (assignment && !isEditingExisting) {
                return (
              <div className="space-y-4">
                {/* Assignee Identity Block */}
                <div className="rounded-xl border border-border/60 bg-gradient-to-br from-accent/20 to-background p-4">
                  <div className="flex items-start gap-4">
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md shrink-0"
                      style={{ backgroundColor: assigneeColor }}
                    >
                      {assigneeName ? getInitials(assigneeName) : "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {assignment.assignedToTeamId && assignment.team ? (
                          <Badge style={{ backgroundColor: assignment.team.color || "#3B82F6" }} className="text-white px-3 py-0.5 text-xs shadow-sm">
                            <Users className="h-3 w-3 mr-1.5" />{assignment.team.name}
                          </Badge>
                        ) : assignment.assignedToUserId && assignment.user ? (
                          <Badge variant="secondary" className="px-3 py-0.5 text-xs shadow-sm">
                            <User className="h-3 w-3 mr-1.5" />{assignment.user.displayName}
                          </Badge>
                        ) : null}
                        {isOverdue && (
                          <Badge variant="destructive" className="text-xs px-2 py-0.5 gap-1">
                            <AlertTriangle className="h-3 w-3" />{t('collaboration.sectionAssignment.slaWarning')}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            <span className="font-medium text-foreground/70">{t('collaboration.sectionAssignment.assignedBy')}: </span>
                            {assignment.assignedByUser?.displayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>{format(new Date(assignment.assignedAt), "MMM d, yyyy")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {workloadCount > 1 && (
                    <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
                      <Activity className="h-3 w-3 text-primary shrink-0" />
                      <span>{assigneeName} owns <span className="font-semibold text-foreground">{workloadCount}</span> of <span className="font-semibold text-foreground">{totalAssigned}</span> {t('collaboration.sectionAssignment.ofSections', { total: totalAssigned })}</span>
                    </div>
                  )}
                </div>

                {/* Quick Status Actions */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                    <ChevronRight className="h-3 w-3" />{t('collaboration.sectionAssignment.quickStatusActions')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_ORDER.filter((s) => s !== assignment.status).map((status) => {
                      const config = STATUS_CONFIG[status];
                      const Icon = config.icon;
                      const styles = stepStyles[status];
                      return (
                        <button
                          key={status}
                          onClick={() => updateStatusMutation.mutate(status)}
                          disabled={updateStatusMutation.isPending}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left",
                            "hover:border-primary/40 hover:bg-accent/50 border-border/50 text-muted-foreground",
                            updateStatusMutation.isPending && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span className={cn("flex h-5 w-5 items-center justify-center rounded-md text-white shrink-0", styles.bg)}>
                            <Icon className="h-3 w-3" />
                          </span>
                          <span className={cn("truncate", styles.text)}>{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notes block with copy */}
                {assignment.notes ? (
                  <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                            {t('collaboration.sectionAssignment.assignmentNotes')}
                          </p>
                          <p className="text-sm text-foreground leading-relaxed">{assignment.notes}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleCopyNotes}
                        className="h-7 w-7 flex items-center justify-center rounded-md border border-border/50 bg-background hover:bg-accent transition-colors shrink-0"
                        title="Copy notes"
                      >
                        {notesCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 py-2">
                    <Info className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    <span className="italic">{t('collaboration.sectionAssignment.noNotes')}</span>
                  </div>
                )}

                {/* Last Update */}
                {assignment.statusUpdatedAt && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border/30">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>{t('collaboration.sectionAssignment.lastUpdated', { date: format(new Date(assignment.statusUpdatedAt), "MMM d, yyyy 'at' h:mm a") })}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsEditingExisting(true)} disabled={assignMutation.isPending}>
                    <Settings className="h-4 w-4 mr-2" />{t('collaboration.sectionAssignment.reassign')}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)} disabled={removeMutation.isPending} data-testid={`button-remove-${sectionName}`}>
                    <X className="h-4 w-4 mr-2" />{t('collaboration.sectionAssignment.remove')}
                  </Button>
                </div>
              </div>
                );
              }
              return (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Assignment Type Toggle */}
                  <FormField
                    control={form.control}
                    name="assignmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          <UserCog className="h-3.5 w-3.5 text-primary" />
                          {t('collaboration.sectionAssignment.assignTo')}
                        </FormLabel>
                        <FormControl>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => { field.onChange("team"); form.setValue("assignedToUserId", null); }}
                              className={cn(
                                "flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all",
                                field.value === "team"
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent/50"
                              )}
                            >
                              <Users className="h-4 w-4" />{t('collaboration.sectionAssignment.team')}
                            </button>
                            <button
                              type="button"
                              onClick={() => { field.onChange("user"); form.setValue("assignedToTeamId", null); }}
                              className={cn(
                                "flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all",
                                field.value === "user"
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent/50"
                              )}
                            >
                              <User className="h-4 w-4" />{t('collaboration.sectionAssignment.individual')}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Team Selection */}
                  {assignmentType === "team" && (
                    <FormField
                      control={form.control}
                      name="assignedToTeamId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('collaboration.sectionAssignment.selectTeam')}</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value)} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('collaboration.sectionAssignment.chooseTeam')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {teams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                  <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: team.color || "#3B82F6" }} />
                                    {team.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* User Selection */}
                  {assignmentType === "user" && (
                    <FormField
                      control={form.control}
                      name="assignedToUserId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('collaboration.sectionAssignment.selectUser')}</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value)} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('collaboration.sectionAssignment.chooseUser')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {users.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                                      {getInitials(user.displayName)}
                                    </div>
                                    {user.displayName}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('collaboration.sectionAssignment.notesOptional')}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value || ""}
                            placeholder={t('collaboration.sectionAssignment.notesPlaceholder')}
                            className="resize-none bg-background/50"
                            rows={3}
                            maxLength={500}
                          />
                        </FormControl>
                        <div className="flex justify-between items-center">
                          <FormDescription className="text-xs">{t('collaboration.sectionAssignment.notesDescription')}</FormDescription>
                          <span className="text-xs text-muted-foreground">{(field.value || "").length}/500</span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={assignMutation.isPending || !form.formState.isValid}
                    data-testid={`button-save-${sectionName}`}
                  >
                    {assignMutation.isPending ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                        {t('collaboration.sectionAssignment.assigning')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t('collaboration.sectionAssignment.assignSectionButton')}
                      </>
                    )}
                  </Button>
                </form>
              </Form>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('collaboration.sectionAssignment.removeAssignmentTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('collaboration.sectionAssignment.removeAssignmentDesc', { section: sectionLabel })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>{t('collaboration.sectionAssignment.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {removeMutation.isPending ? t('collaboration.sectionAssignment.removing') : t('collaboration.sectionAssignment.removeAssignment')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
