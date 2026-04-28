import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getWorkflowStatusColor, getWorkflowStatusLabel, resolveDemandDisplayWorkflowStatus } from "./demandAnalysisReport.utils";
import type { DemandReport, WorkflowUpdateData } from "./demandAnalysisReport.types";
import {
  FileText, Eye, Clock, XCircle, CheckCircle, Sparkles, Loader2, Pencil, Check, X, ShieldCheck,
} from "lucide-react";

// ============================================================================
// DEMAND INFO HEADER COMPONENT
// ============================================================================

interface DemandInfoHeaderProps {
  report: DemandReport;
  workflowActioned: boolean;
  id: string;
  updateWorkflowMutation: { mutate: (data: WorkflowUpdateData, options?: { onSuccess?: () => void; onError?: (error: unknown) => void }) => void; isPending: boolean };
  onShowSmartPanel: () => void;
  approvalReasons?: string[];
}

export function DemandInfoHeader({
  report,
  workflowActioned,
  updateWorkflowMutation,
  onShowSmartPanel,
  approvalReasons = [],
}: DemandInfoHeaderProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [headerAction, setHeaderAction] = useState("");
  const [headerReason, setHeaderReason] = useState("");
  const [showActionInput, setShowActionInput] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(report.suggestedProjectName || "");
  const displayWorkflowStatus = resolveDemandDisplayWorkflowStatus(report.workflowStatus, report.workflowHistory);
  const acknowledgementReason = approvalReasons.length > 0
    ? `Acknowledged after Corevia Brain governance review: ${approvalReasons.join("; ")}`
    : "";

  // Mutation to update the suggested project name
  const updateNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const response = await apiRequest("PATCH", `/api/demand-reports/${report.id}`, {
        suggestedProjectName: newName.trim() || null
      });
      if (!response.ok) throw new Error("Failed to update project name");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', report.id] });
      toast({
        title: t('demand.analysis.infoHeader.projectNameUpdated'),
        description: t('demand.analysis.infoHeader.projectNameSaved'),
      });
      setIsEditingName(false);
    },
    onError: () => {
      toast({
        title: t('demand.analysis.infoHeader.error'),
        description: t('demand.analysis.infoHeader.updateFailed'),
        variant: "destructive",
      });
    }
  });

  const handleHeaderAction = () => {
    if (!headerAction) return;

    const updateData: WorkflowUpdateData = {
      workflowStatus: headerAction,
      decisionReason: headerReason.trim() || t('demand.analysis.infoHeader.actionTaken', { action: headerAction }),
    };

    updateWorkflowMutation.mutate(updateData, {
      onSuccess: () => {
        setHeaderAction("");
        setHeaderReason("");
        setShowActionInput(false);
      }
    });
  };

  const quickActions = [
    {
      id: 'acknowledged',
      label: t('demand.analysis.infoHeader.acknowledge'),
      icon: Eye,
      gradient: 'from-blue-500 to-blue-600',
      hoverGradient: 'hover:from-blue-600 hover:to-blue-700',
    },
    {
      id: 'deferred',
      label: t('demand.analysis.infoHeader.defer'),
      icon: Clock,
      gradient: 'from-amber-500 to-orange-600',
      hoverGradient: 'hover:from-amber-600 hover:to-orange-700',
    },
    {
      id: 'rejected',
      label: t('demand.analysis.infoHeader.reject'),
      icon: XCircle,
      gradient: 'from-red-500 to-red-600',
      hoverGradient: 'hover:from-red-600 hover:to-red-700',
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-900/50 dark:via-blue-950/30 dark:to-slate-900/50 border border-slate-200/50 dark:border-slate-700/50">
        {/* Left: Title and Status */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {report.projectId && (
                <Badge variant="secondary" className="text-xs font-mono bg-slate-100 dark:bg-slate-800" data-testid="header-project-id">
                  {report.projectId}
                </Badge>
              )}
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder={t('demand.analysis.infoHeader.enterProjectName')}
                    className="h-8 w-64 text-sm"
                    autoFocus
                    data-testid="input-edit-project-name"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => updateNameMutation.mutate(editedName)}
                    disabled={updateNameMutation.isPending}
                    data-testid="button-save-project-name"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditedName(report.suggestedProjectName || "");
                      setIsEditingName(false);
                    }}
                    data-testid="button-cancel-edit-name"
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">
                    {report.suggestedProjectName || t('demand.analysis.infoHeader.demandRequestDetails')}
                  </h3>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-60 hover:opacity-100"
                    onClick={() => setIsEditingName(true)}
                    title={t('demand.analysis.infoHeader.editProjectName')}
                    data-testid="button-edit-project-name"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className={`${getWorkflowStatusColor(displayWorkflowStatus)} text-xs`}>
                {getWorkflowStatusLabel(displayWorkflowStatus || 'generated')}
              </Badge>
              {workflowActioned && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {t('demand.analysis.infoHeader.actioned')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {!workflowActioned ? (
            <>
              {/* Smart Decision Panel Button */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={onShowSmartPanel}
                  className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-md shadow-violet-500/25"
                  size="sm"
                  data-testid="button-smart-panel-header"
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  {t('demand.analysis.infoHeader.smartDecision')}
                </Button>
              </motion.div>

              {/* Quick Action Buttons */}
              {quickActions.map((action) => {
                const Icon = action.icon;
                const isSelected = headerAction === action.id;

                return (
                  <motion.div
                    key={action.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      onClick={() => {
                        setHeaderAction(action.id);
                        setShowActionInput(true);
                        if (action.id === "acknowledged" && !headerReason.trim() && acknowledgementReason) {
                          setHeaderReason(acknowledgementReason);
                        }
                      }}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={isSelected
                        ? `bg-gradient-to-r ${action.gradient} ${action.hoverGradient} text-white border-0 shadow-md`
                        : "hover-elevate"
                      }
                      data-testid={`button-header-${action.id}`}
                    >
                      <Icon className="h-4 w-4 mr-1.5" />
                      {action.label}
                    </Button>
                  </motion.div>
                );
              })}
            </>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">{t('demand.analysis.infoHeader.workflowComplete')}</span>
            </div>
          )}
        </div>
      </div>

      {!workflowActioned && approvalReasons.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
              <ShieldCheck className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Corevia Brain requires acknowledgement before analysis unlocks
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                  These reasons will be recorded with the acknowledgement so Layer 7 has a clear human decision trail.
                </p>
              </div>
              <ul className="space-y-1 text-sm text-amber-900 dark:text-amber-100">
                {approvalReasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-600" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Panel */}
      <AnimatePresence>
        {showActionInput && headerAction && !workflowActioned && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-4 rounded-xl bg-muted/30 border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary">
                    {quickActions.find(a => a.id === headerAction)?.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{t('demand.analysis.infoHeader.confirmAction')}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowActionInput(false);
                    setHeaderAction("");
                  }}
                  className="h-6 w-6"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={headerReason}
                onChange={(e) => setHeaderReason(e.target.value)}
                placeholder={t('demand.analysis.infoHeader.addNotesPlaceholder')}
                className="text-sm resize-none"
                rows={2}
                data-testid="textarea-header-action-reason"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowActionInput(false);
                    setHeaderAction("");
                  }}
                >
                  {t('demand.analysis.infoHeader.cancel')}
                </Button>
                <Button
                  onClick={handleHeaderAction}
                  disabled={updateWorkflowMutation.isPending}
                  size="sm"
                  className="bg-gradient-to-r from-primary to-primary/80"
                  data-testid="button-confirm-header-action"
                >
                  {updateWorkflowMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      {t('demand.analysis.infoHeader.processing')}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      {t('demand.analysis.infoHeader.confirmAndUnlock')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
