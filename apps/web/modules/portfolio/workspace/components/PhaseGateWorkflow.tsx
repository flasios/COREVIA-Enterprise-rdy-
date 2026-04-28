import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Rocket,
  Map,
  Settings2,
  Activity,
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  AlertTriangle,
  Send,
  FileCheck,
  RefreshCw,
  ChevronRight,
  Sparkles,
  MousePointerClick,
  Bell,
  RotateCcw,
  BadgeCheck as _BadgeCheck,
  ShieldAlert,
} from 'lucide-react';

const PHASES = [
  { 
    id: 'initiation', 
    label: 'Initiation', 
    icon: Rocket,
    description: 'Charter & Scope'
  },
  { 
    id: 'planning', 
    label: 'Planning', 
    icon: Map,
    description: 'WBS & Resources'
  },
  { 
    id: 'execution', 
    label: 'Execution', 
    icon: Settings2,
    description: 'Delivery & Build'
  },
  { 
    id: 'monitoring', 
    label: 'Monitoring', 
    icon: Activity,
    description: 'Track & Control'
  },
  { 
    id: 'closure', 
    label: 'Closure', 
    icon: Trophy,
    description: 'Handover & Close'
  },
];

const DEFAULT_UNLOCKED_FUTURE_PHASES = new Set<string>();

interface GateCheck {
  id: string;
  name: string;
  category: string;
  status: 'pending' | 'passed' | 'failed' | 'waived';
  isCritical: boolean;
  isRequired: boolean;
  notes?: string;
}

interface PhaseGateData {
  phase: string;
  status: 'locked' | 'in_progress' | 'pending_approval' | 'approved' | 'rejected' | 'ready_for_review';
  readinessScore: number;
  checks: GateCheck[];
  criticalPassed: number;
  criticalTotal: number;
  totalPassed: number;
  totalChecks: number;
  wasRejected?: boolean; // Track if this gate came from a rejected state (for resubmit UI)
}

interface GateOverviewResponse {
  success: boolean;
  data: {
    projectId: string;
    currentPhase: string;
    phases: PhaseGateData[];
    overallProgress: number;
  };
}

interface PhaseGateWorkflowProps {
  projectId: string;
  currentPhase: string;
  onPhaseChange?: (phase: string) => void;
}

 
export function PhaseGateWorkflow({ projectId, currentPhase, onPhaseChange: _onPhaseChange }: PhaseGateWorkflowProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [showReadyPopup, setShowReadyPopup] = useState(false);
  const [shownPopupPhases, setShownPopupPhases] = useState<Set<string>>(new Set());
  const [notifiedPhases, setNotifiedPhases] = useState<Set<string>>(new Set());
  const notificationInFlightRef = useRef<Set<string>>(new Set());
  const failedNotificationsRef = useRef<Set<string>>(new Set());

  const { data: gateOverview, isLoading, refetch } = useQuery<GateOverviewResponse>({
    queryKey: ['/api/gates', projectId, 'overview'],
  });

  const requestApprovalMutation = useMutation({
    mutationFn: async (phase: string) => {
      const res = await apiRequest('POST', `/api/gates/${projectId}/request-approval`, { phase });
      return res.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: t('projectWorkspace.toast.approvalRequested'), description: t('projectWorkspace.toast.approvalRequestedDesc') });
        queryClient.invalidateQueries({ queryKey: ['/api/gates', projectId] });
        refetch();
      } else {
        toast({ title: t('projectWorkspace.toast.cannotRequest'), description: result.message, variant: 'destructive' });
      }
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.error'), description: t('projectWorkspace.toast.failedRequestApproval'), variant: 'destructive' });
    },
  });

  const updateCheckMutation = useMutation({
    mutationFn: async ({ checkId, status }: { checkId: string; status: string }) => {
      const res = await apiRequest('PATCH', `/api/gates/checks/${checkId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gates', projectId] });
      refetch();
    },
  });

  const phases = gateOverview?.data?.phases || [];
  // Use the authoritative currentPhase from gate overview ONLY when data is loaded
  // This ensures we don't use stale prop data that shows wrong phase status
  const gateDataLoaded = !!gateOverview?.data?.currentPhase;
  const effectiveCurrentPhase = gateOverview?.data?.currentPhase || currentPhase;
  const currentPhaseIndex = gateDataLoaded 
    ? PHASES.findIndex(p => p.id === effectiveCurrentPhase)
    : -1; // Use -1 when loading to avoid showing incorrect approved states

  const getPhaseStatus = (phaseId: string) => {
    const phaseIndex = PHASES.findIndex(p => p.id === phaseId);
    const phaseData = phases.find(p => p.phase === phaseId);
    if (phaseData) return phaseData.status;
    if (phaseIndex < currentPhaseIndex) return 'approved';
    if (phaseIndex === currentPhaseIndex) return 'in_progress';
    if (DEFAULT_UNLOCKED_FUTURE_PHASES.has(phaseId)) return 'in_progress';
    return 'locked';
  };

  const getPhaseData = (phaseId: string): PhaseGateData | undefined => {
    return phases.find(p => p.phase === phaseId);
  };

  const canRequestApproval = (phaseId: string) => {
    const phaseData = getPhaseData(phaseId);
    if (!phaseData) return false;
    // Allow submission from:
    // - in_progress: initial submission
    // - rejected: resubmission (when readiness is still below threshold)
    // - ready_for_review: resubmission (when readiness restored from rejection) or initial when ready
    const validStatuses = ['in_progress', 'rejected', 'ready_for_review'];
    return validStatuses.includes(phaseData.status) && 
          phaseData.totalChecks > 0 &&
           phaseData.readinessScore >= 80 && 
           phaseData.criticalPassed === phaseData.criticalTotal;
  };

  // Check for a phase that was rejected and is now ready to resubmit
  // This includes: status='rejected' with readiness>=80 OR status='ready_for_review' with wasRejected flag
  const rejectedPhaseReady = PHASES.find(p => {
    const data = getPhaseData(p.id);
    if (!data) return false;
    const isReady = data.totalChecks > 0 && data.readinessScore >= 80 && data.criticalPassed === data.criticalTotal;
    // Include both current rejected status AND wasRejected flag (for gates that transitioned to ready_for_review)
    return isReady && (data.status === 'rejected' || data.wasRejected);
  });
  
  // Track any phase that is currently rejected or was recently rejected (for UI styling)
  const _rejectedPhase = PHASES.find(p => {
    const data = getPhaseData(p.id);
    return data?.status === 'rejected' || data?.wasRejected;
  });

  // Check for recently approved phase (for notification)
  const _approvedPhases = PHASES.filter(p => {
    const data = getPhaseData(p.id);
    return data?.status === 'approved';
  });

  const handlePhaseClick = (phaseId: string) => {
    const status = getPhaseStatus(phaseId);
    if (status !== 'locked') {
      setSelectedPhase(phaseId);
      setShowPanel(true);
    }
  };

  // Find phases ready for approval (includes in_progress and ready_for_review statuses)
  const readyPhase = PHASES.find(p => {
    const data = getPhaseData(p.id);
    if (!data) return false;
    const validStatuses = ['in_progress', 'ready_for_review'];
    return validStatuses.includes(data.status) && data.totalChecks > 0 && data.readinessScore >= 80 && data.criticalPassed === data.criticalTotal;
  });

  const pendingApprovalPhase = PHASES.find(p => getPhaseData(p.id)?.status === 'pending_approval');

  // Show popup when a gate becomes ready (track each phase separately, scoped by projectId)
  useEffect(() => {
    const popupKey = `${projectId}:${readyPhase?.id}`;
    if (readyPhase && !shownPopupPhases.has(popupKey) && !pendingApprovalPhase) {
      const timer = setTimeout(() => {
        setShowReadyPopup(true);
        setShownPopupPhases(prev => new Set(prev).add(popupKey));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [readyPhase, shownPopupPhases, pendingApprovalPhase, projectId]);

  // Send COREVIA notification when a gate becomes ready for approval
  // Uses refs to track in-flight requests and failed attempts to prevent duplicate calls and API spam
  useEffect(() => {
    const notificationKey = `${projectId}:${readyPhase?.id}`;
    
    if (readyPhase && 
        !notifiedPhases.has(notificationKey) && 
        !notificationInFlightRef.current.has(notificationKey) && 
        !failedNotificationsRef.current.has(notificationKey) &&
        !pendingApprovalPhase) {
      const phaseId = readyPhase.id;
      const phaseName = PHASES.find(p => p.id === phaseId)?.label || phaseId;
      
      // Mark as in-flight immediately to prevent duplicate calls
      notificationInFlightRef.current.add(notificationKey);
      
      // Create COREVIA notification (async IIFE)
      (async () => {
        try {
          await apiRequest('POST', '/api/ai-assistant/execute-action', {
            actionType: 'alert',
            actionData: {
              title: `${phaseName} Gate Ready for PMO Review`,
              message: `The ${phaseName} phase has reached the approval threshold and all configured governance checks are currently passing. This gate is ready to be submitted for PMO review.`
            }
          });
          // Mark as notified permanently on success
          setNotifiedPhases(prev => new Set(prev).add(notificationKey));
        } catch (err) {
          console.error('[PhaseGateWorkflow] Failed to create COREVIA notification:', err);
          // Mark as failed to prevent repeated retries during this session
          // User can refresh the page to retry
          failedNotificationsRef.current.add(notificationKey);
        } finally {
          // Clear in-flight status
          notificationInFlightRef.current.delete(notificationKey);
        }
      })();
    }
  }, [readyPhase, notifiedPhases, pendingApprovalPhase, projectId]);
  
  // Clear failed notification flag when gate is no longer ready (allows retry when it becomes ready again)
  useEffect(() => {
    if (!readyPhase) {
      // Clear all failed notifications for this project when no gates are ready
      // This allows retry when a gate becomes ready again
      const projectPrefix = `${projectId}:`;
      const keysToRemove: string[] = [];
      failedNotificationsRef.current.forEach(key => {
        if (key.startsWith(projectPrefix)) {
          keysToRemove.push(key);
        }
      });
      keysToRemove.forEach(key => failedNotificationsRef.current.delete(key));
    }
  }, [readyPhase, projectId]);

  // Auto-hide popup after 6 seconds
  useEffect(() => {
    if (showReadyPopup) {
      const timer = setTimeout(() => {
        setShowReadyPopup(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [showReadyPopup]);

  if (isLoading) {
    return (
      <div className="h-14 bg-card border border-border rounded-lg flex items-center justify-center">
        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Compact Governance Timeline */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Timeline Row */}
        <div className="flex items-stretch">
          {PHASES.map((phase, index) => {
            const status = getPhaseStatus(phase.id);
            const phaseData = getPhaseData(phase.id);
            const PhaseIcon = phase.icon;
            const isActive = phase.id === effectiveCurrentPhase;
            const isPast = index < currentPhaseIndex;
            const isLocked = status === 'locked';
            const isPendingApproval = status === 'pending_approval';
            const isRejected = status === 'rejected';
            const hasConfiguredChecks = (phaseData?.totalChecks || 0) > 0;
            const isApproved = status === 'approved' && hasConfiguredChecks;
            const hasApprovalConfigGap = status === 'approved' && !hasConfiguredChecks;
            // isReady only for in_progress phases that were NOT rejected - rejected/wasRejected uses canResubmit instead
            // Never show ready animation for past/approved phases
            const isReady = !isPast && !isApproved && phaseData && phaseData.readinessScore >= 80 && status === 'in_progress' && !phaseData.wasRejected && phaseData.criticalPassed === phaseData.criticalTotal;
            // canResubmit for rejected phases or phases that were rejected (wasRejected flag)
            // Never show resubmit for past/approved phases
            const canResubmit = !isPast && !isApproved && phaseData && (isRejected || phaseData.wasRejected) && phaseData.readinessScore >= 80 && phaseData.criticalPassed === phaseData.criticalTotal;
            const readiness = phaseData?.readinessScore || 0;

            return (
              <div key={phase.id} className="flex-1 flex items-stretch">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handlePhaseClick(phase.id)}
                      disabled={isLocked}
                      className={cn(
                        "flex-1 flex items-center gap-2 px-3 py-1.5 transition-all relative group",
                        "border-r border-border last:border-r-0",
                        isLocked && "opacity-50 cursor-not-allowed bg-muted/30",
                        isPast && "bg-emerald-500/10 dark:bg-emerald-500/5",
                        isActive && !isPendingApproval && !isRejected && "bg-primary/10 dark:bg-primary/5",
                        isPendingApproval && "bg-amber-500/10 dark:bg-amber-500/5",
                        isRejected && "bg-red-500/10 dark:bg-red-500/5",
                        !isLocked && "hover:bg-accent/50 cursor-pointer"
                      )}
                      data-testid={`gate-phase-${phase.id}`}
                    >
                      {/* Phase Icon with Animation */}
                      <motion.div 
                        className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors relative",
                          "border shadow-sm",
                          isLocked && "bg-muted border-muted-foreground/20",
                          (isPast || isApproved) && "bg-emerald-500 border-emerald-400 text-white",
                          isActive && !isPendingApproval && !isReady && !isRejected && !isApproved && "bg-primary border-primary/60 text-primary-foreground",
                          isPendingApproval && "bg-amber-500 border-amber-400 text-white",
                          isRejected && !canResubmit && "bg-red-500 border-red-400 text-white",
                          canResubmit && "bg-orange-500 border-orange-400 text-white",
                          isReady && !isPendingApproval && !isRejected && !isApproved && "bg-emerald-500 border-emerald-400 text-white",
                          !isLocked && !isPast && !isActive && !isRejected && !isApproved && "bg-card border-border text-muted-foreground"
                        )}
                        whileHover={!isLocked ? { scale: 1.1 } : {}}
                        whileTap={!isLocked ? { scale: 0.95 } : {}}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      >
                        {isLocked ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : isPast || isApproved ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 15 }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </motion.div>
                        ) : isRejected && !canResubmit ? (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        ) : canResubmit ? (
                          <motion.div
                            animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </motion.div>
                        ) : isPendingApproval ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </motion.div>
                        ) : isReady ? (
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            <PhaseIcon className="w-3.5 h-3.5" />
                          </motion.div>
                        ) : (
                          <PhaseIcon className="w-3.5 h-3.5" />
                        )}
                        
                        {/* Notification bell animation for ready state (only when in_progress, not rejected) */}
                        {isReady && !isPendingApproval && !isRejected && (
                          <motion.div
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-card"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                            <Bell className="w-2 h-2 text-white" />
                          </motion.div>
                        )}
                        
                        {/* Resubmit notification icon for rejected gates that can be resubmitted */}
                        {canResubmit && (
                          <motion.div
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-500 rounded-full flex items-center justify-center border-2 border-card"
                            animate={{ rotate: [0, -15, 15, -15, 15, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
                          >
                            <RotateCcw className="w-2 h-2 text-white" />
                          </motion.div>
                        )}
                        
                        {/* Approved badge - show briefly after approval (now main icon shows checkmark, so just a subtle badge) */}
                        {isApproved && !isPast && (
                          <motion.div
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-600 rounded-full flex items-center justify-center border-2 border-card"
                            initial={{ scale: 0 }}
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.3 }}
                          >
                            <Sparkles className="w-2 h-2 text-white" />
                          </motion.div>
                        )}
                        
                        {/* Ready indicator pulse (only when in_progress, not rejected) */}
                        {isReady && !isPendingApproval && !isRejected && (
                          <motion.div
                            className="absolute inset-0 rounded-md bg-emerald-400/30"
                            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        )}
                        
                        {/* Resubmit pulse for rejected (separate from ready pulse) */}
                        {canResubmit && (
                          <motion.div
                            className="absolute inset-0 rounded-md bg-orange-400/30"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0, 0.4] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                        )}
                      </motion.div>

                      {/* Phase Info — compact single-line: label + % + inline progress underline */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn(
                              "text-[12.5px] font-medium truncate",
                              isLocked ? "text-muted-foreground" : "text-foreground"
                            )}>
                              {phase.label}
                            </span>
                            {isPendingApproval && (
                              <Badge variant="outline" className="h-4 shrink-0 px-1 text-[9px] leading-none border-amber-500/50 text-amber-600 dark:text-amber-400">Pending</Badge>
                            )}
                            {hasApprovalConfigGap && (
                              <Badge variant="outline" className="h-4 shrink-0 px-1 text-[9px] leading-none border-amber-500/50 text-amber-600 dark:text-amber-400">Config</Badge>
                            )}
                            {isApproved && !isPast && (
                              <Badge variant="outline" className="h-4 shrink-0 px-1 text-[9px] leading-none border-emerald-500/50 text-emerald-600 dark:text-emerald-400">Approved</Badge>
                            )}
                            {isRejected && !isApproved && (
                              <Badge variant="outline" className="h-4 shrink-0 px-1 text-[9px] leading-none border-red-500/50 text-red-600 dark:text-red-400">
                                {canResubmit ? 'Resubmit' : 'Rejected'}
                              </Badge>
                            )}
                            {isReady && !isPendingApproval && !isRejected && !isApproved && (
                              <Badge variant="outline" className="h-4 shrink-0 px-1 text-[9px] leading-none border-emerald-500/50 text-emerald-600 dark:text-emerald-400">Ready</Badge>
                            )}
                          </div>
                          {!isLocked && phaseData && (
                            <span className={cn(
                              "text-[10px] font-semibold tabular-nums shrink-0",
                              isPast ? "text-emerald-600 dark:text-emerald-400" :
                              readiness >= 80 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                            )}>
                              {isPast ? '100' : readiness}%
                            </span>
                          )}
                        </div>
                        {/* Inline progress underline (no percentage duplicated — it's in the row above) */}
                        {!isLocked && phaseData && (
                          <div className="mt-1 h-0.5 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all",
                                isPast ? "bg-emerald-500" :
                                readiness >= 80 ? "bg-emerald-500" : 
                                readiness >= 50 ? "bg-amber-500" : "bg-muted-foreground/40"
                              )}
                              style={{ width: `${isPast ? 100 : readiness}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Arrow connector */}
                      {index < PHASES.length - 1 && (
                        <ChevronRight className={cn(
                          "w-3 h-3 absolute right-0 translate-x-1/2 z-10",
                          index < currentPhaseIndex ? "text-emerald-500" : "text-border"
                        )} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="space-y-1">
                      <p className="font-medium">{phase.label} Gate</p>
                      <p className="text-xs text-muted-foreground">{phase.description}</p>
                      {phaseData && (
                        <p className="text-xs">
                          Checks: {phaseData.totalPassed}/{phaseData.totalChecks} | 
                          Critical: {phaseData.criticalPassed}/{phaseData.criticalTotal}
                        </p>
                      )}
                      {hasApprovalConfigGap && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Gate shows approved without configured checks</p>
                      )}
                      {!isLocked && <p className="text-xs text-primary">Click to view checklist</p>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>

        {/* Notification Bar */}
        <AnimatePresence>
          {(readyPhase || pendingApprovalPhase || rejectedPhaseReady) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className={cn(
                "px-4 py-2.5 border-t flex items-center justify-between gap-3",
                pendingApprovalPhase 
                  ? "bg-amber-500/10 border-amber-500/20" 
                  : rejectedPhaseReady
                    ? "bg-orange-500/10 border-orange-500/20"
                    : "bg-emerald-500/10 border-emerald-500/20"
              )}>
                <div className="flex items-center gap-2">
                  {pendingApprovalPhase ? (
                    <>
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        {PHASES.find(p => p.id === pendingApprovalPhase.id)?.label} gate awaiting PMO approval
                      </span>
                    </>
                  ) : rejectedPhaseReady ? (
                    <>
                      <motion.div
                        animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                      >
                        <RotateCcw className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      </motion.div>
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                        {PHASES.find(p => p.id === rejectedPhaseReady.id)?.label} gate was rejected — ready to resubmit
                      </span>
                    </>
                  ) : readyPhase ? (
                    <>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </motion.div>
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        {PHASES.find(p => p.id === readyPhase.id)?.label} gate ready for PMO review
                      </span>
                      <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70 hidden sm:inline">
                        — Click the phase to open checklist
                      </span>
                    </>
                  ) : null}
                </div>
                
                {/* Request/Resubmit button */}
                {((readyPhase && !pendingApprovalPhase) || rejectedPhaseReady) && (
                  <Button
                    onClick={() => requestApprovalMutation.mutate(rejectedPhaseReady?.id || readyPhase?.id || '')}
                    disabled={requestApprovalMutation.isPending}
                    size="sm"
                    className={cn(
                      "h-7 gap-1.5",
                      rejectedPhaseReady && "bg-orange-500 hover:bg-orange-600"
                    )}
                  >
                    {requestApprovalMutation.isPending ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : rejectedPhaseReady ? (
                      <RotateCcw className="w-3 h-3" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    {rejectedPhaseReady ? 'Resubmit for Approval' : 'Request Approval'}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ready Gate Popup Notification - Enhanced Animation */}
      <AnimatePresence>
        {showReadyPopup && readyPhase && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
            }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50"
          >
            {/* Outer glow effect */}
            <motion.div
              className="absolute inset-0 rounded-xl bg-emerald-500/20 blur-xl"
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            
            {/* Main popup card with pulsing border */}
            <motion.div 
              className="relative bg-card border-2 border-emerald-500 rounded-xl shadow-2xl p-4 min-w-[360px]"
              animate={{ 
                boxShadow: [
                  '0 0 0 0 rgba(16, 185, 129, 0.4)',
                  '0 0 0 8px rgba(16, 185, 129, 0)',
                  '0 0 0 0 rgba(16, 185, 129, 0.4)'
                ]
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {/* Celebration sparkles */}
              <motion.div
                className="absolute -top-2 -right-2"
                animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                  <Bell className="w-4 h-4 text-white" />
                </div>
              </motion.div>
              
              <div className="flex items-start gap-4">
                {/* Animated icon */}
                <motion.div 
                  className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg"
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Sparkles className="w-6 h-6 text-white" />
                </motion.div>
                
                <div className="flex-1">
                  <motion.p 
                    className="font-bold text-lg text-emerald-600 dark:text-emerald-400"
                    animate={{ opacity: [1, 0.8, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    Gate Ready for PMO Review!
                  </motion.p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-semibold text-foreground">{PHASES.find(p => p.id === readyPhase.id)?.label}</span> phase has satisfied the configured governance checks
                  </p>
                  
                  <motion.button
                    onClick={() => {
                      handlePhaseClick(readyPhase.id);
                      setShowReadyPopup(false);
                    }}
                    className="mt-3 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-md transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <MousePointerClick className="w-4 h-4" />
                    Open Checklist & Submit
                  </motion.button>
                </div>
                
                <button
                  onClick={() => setShowReadyPopup(false)}
                  className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-out Checklist Panel */}
      <ChecklistPanel
        open={showPanel}
        onClose={() => setShowPanel(false)}
        phase={selectedPhase || effectiveCurrentPhase}
        phaseData={getPhaseData(selectedPhase || effectiveCurrentPhase)}
        phaseStatus={getPhaseStatus(selectedPhase || effectiveCurrentPhase)}
        canRequestApproval={canRequestApproval(selectedPhase || effectiveCurrentPhase)}
        onRequestApproval={() => requestApprovalMutation.mutate(selectedPhase || effectiveCurrentPhase)}
        onUpdateCheck={(checkId, status) => updateCheckMutation.mutate({ checkId, status })}
        isRequestingApproval={requestApprovalMutation.isPending}
        isRejected={getPhaseData(selectedPhase || effectiveCurrentPhase)?.status === 'rejected' || getPhaseData(selectedPhase || effectiveCurrentPhase)?.wasRejected}
      />
    </div>
  );
}

interface ChecklistPanelProps {
  open: boolean;
  onClose: () => void;
  phase: string;
  phaseData?: PhaseGateData;
  phaseStatus: string;
  canRequestApproval: boolean;
  onRequestApproval: () => void;
  onUpdateCheck: (checkId: string, status: string) => void;
  isRequestingApproval: boolean;
  isRejected?: boolean;
}

function ChecklistPanel({
  open,
  onClose,
  phase,
  phaseData,
  phaseStatus,
  canRequestApproval,
  onRequestApproval,
  onUpdateCheck,
  isRequestingApproval,
  isRejected,
}: ChecklistPanelProps) {
  const { t } = useTranslation();
  const phaseConfig = PHASES.find(p => p.id === phase);
  const PhaseIcon = phaseConfig?.icon || Rocket;
  
  const readinessScore = phaseData?.readinessScore || 0;
  const totalPassed = phaseData?.totalPassed || 0;
  const totalChecks = phaseData?.totalChecks || 0;
  const criticalPassed = phaseData?.criticalPassed || 0;
  const criticalTotal = phaseData?.criticalTotal || 0;
  const checks = phaseData?.checks || [];
  const hasConfiguredChecks = totalChecks > 0;
  const approvalConfigGap = phaseStatus === 'approved' && !hasConfiguredChecks;
  
  const checksByCategory = checks.reduce((acc, check) => {
    const category = check.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(check);
    return acc;
  }, {} as Record<string, GateCheck[]>);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b bg-card">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center",
              "bg-primary/10 text-primary"
            )}>
              <PhaseIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-lg">{phaseConfig?.label} Gate</SheetTitle>
                {phaseStatus === 'approved' && (
                  <Badge className="bg-emerald-500 text-white gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Approved
                  </Badge>
                )}
                {phaseStatus === 'pending_approval' && (
                  <Badge className="bg-amber-500 text-white gap-1">
                    <Clock className="w-3 h-3" />
                    Pending Approval
                  </Badge>
                )}
                {phaseStatus === 'rejected' && (
                  <Badge className="bg-red-500 text-white gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    Rejected
                  </Badge>
                )}
              </div>
              <SheetDescription className="text-sm">{phaseConfig?.description}</SheetDescription>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className={cn(
                "text-2xl font-bold tabular-nums",
                approvalConfigGap ? "text-amber-600 dark:text-amber-400" :
                readinessScore >= 80 ? "text-emerald-600 dark:text-emerald-400" : 
                readinessScore >= 50 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
              )}>
                {readinessScore}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Readiness</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{totalPassed}<span className="text-muted-foreground">/{totalChecks}</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">Passed</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{criticalPassed}<span className="text-muted-foreground">/{criticalTotal}</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">Critical</p>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Progress to threshold</span>
              <span className={cn(
                "font-medium",
                approvalConfigGap ? "text-amber-600 dark:text-amber-400" :
                readinessScore >= 80 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
              )}>
                {approvalConfigGap ? 'Define gate checks to validate approval' : readinessScore >= 80 ? 'Threshold met' : `${80 - readinessScore}% remaining`}
              </span>
            </div>
            <Progress 
              value={readinessScore} 
              className="h-2"
            />
          </div>
        </SheetHeader>

        {/* Checklist */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {Object.keys(checksByCategory).length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <FileCheck className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">{t('projectWorkspace.phaseGate.noGateChecks')}</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Approval stays informational until governance checks are configured for this gate</p>
              </div>
            ) : (
              <Accordion type="multiple" defaultValue={Object.keys(checksByCategory)} className="space-y-2">
                {Object.entries(checksByCategory).map(([category, categoryChecks]) => {
                  const passedCount = categoryChecks.filter(c => c.status === 'passed').length;
                  
                  return (
                    <AccordionItem 
                      key={category} 
                      value={category}
                      className="border rounded-lg overflow-hidden"
                    >
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/50 text-sm">
                        <div className="flex items-center gap-2 flex-1">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            passedCount === categoryChecks.length ? "bg-emerald-500" : 
                            passedCount > 0 ? "bg-amber-500" : "bg-muted-foreground"
                          )} />
                          <span className="font-medium">{category}</span>
                          <Badge variant="secondary" className="ml-auto mr-2 text-xs">
                            {passedCount}/{categoryChecks.length}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-3">
                        <div className="space-y-1.5">
                          {categoryChecks.map((check) => (
                            <div
                              key={check.id}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border transition-all",
                                check.status === 'passed' && "bg-emerald-500/5 border-emerald-500/20",
                                check.status === 'failed' && "bg-destructive/5 border-destructive/20",
                                check.status === 'pending' && "bg-card border-border hover:border-primary/30"
                              )}
                            >
                              <button
                                onClick={() => onUpdateCheck(check.id, check.status === 'passed' ? 'pending' : 'passed')}
                                className="flex-shrink-0"
                                data-testid={`check-toggle-${check.id}`}
                              >
                                {check.status === 'passed' ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : check.status === 'failed' ? (
                                  <XCircle className="w-5 h-5 text-destructive" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 hover:border-primary transition-colors" />
                                )}
                              </button>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn(
                                    "text-sm",
                                    check.status === 'passed' && "text-emerald-700 dark:text-emerald-300",
                                    check.status === 'failed' && "line-through text-muted-foreground"
                                  )}>
                                    {check.name}
                                  </span>
                                  {check.isCritical && (
                                    <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                                      Critical
                                    </Badge>
                                  )}
                                </div>
                                {check.notes && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{check.notes}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-card mt-auto">
          <div className="flex items-center gap-3 mb-3">
            {approvalConfigGap ? (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Gate configuration required before approval can be trusted</span>
              </div>
            ) : phaseStatus === 'approved' ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Gate Approved — Phase completed successfully</span>
              </div>
            ) : isRejected ? (
              canRequestApproval ? (
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <RotateCcw className="w-4 h-4" />
                  <span className="text-sm font-medium">Ready to resubmit for approval</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <XCircle className="w-4 h-4" />
                  <span className="text-sm">Gate was rejected — complete checks to resubmit</span>
                </div>
              )
            ) : readinessScore >= 80 && criticalPassed === criticalTotal ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Ready for approval</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-sm">Complete more checks to reach 80% threshold</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
            {phaseStatus !== 'approved' && (
              <Button
                onClick={onRequestApproval}
                disabled={!canRequestApproval || isRequestingApproval || !hasConfiguredChecks}
                className={cn(
                  "flex-1 gap-2",
                  isRejected && canRequestApproval && "bg-orange-500 hover:bg-orange-600"
                )}
              >
                {isRequestingApproval ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : isRejected ? (
                  <RotateCcw className="w-4 h-4" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isRejected ? 'Resubmit for Approval' : 'Request Approval'}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
