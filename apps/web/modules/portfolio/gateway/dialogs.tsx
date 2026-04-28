import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Briefcase, Building2, FileText, Loader2, Rocket, Send, Target, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WorkspacePath } from "@shared/schema";
import type { PipelineItem } from "./IntelligentPortfolioGatewayPage";
import { deriveTargetDate, extractBudgetRange, getBudgetPrefillValue, mapUrgencyToPriority, toDateInputValue } from "./utils";

export function ConvertDialog({
  open,
  onOpenChange,
  item,
  workspacePath,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PipelineItem | null;
  workspacePath: WorkspacePath;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onConfirm: (data: any) => void;
  isPending: boolean;
}) {
  const [projectName, setProjectName] = useState("");
  const [priority, setPriority] = useState("medium");
  const [projectType, setProjectType] = useState("transformation");
  const [projectManager, setProjectManager] = useState("");
  const [estimatedBudget, setEstimatedBudget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [strategicObjective, setStrategicObjective] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    if (!open || !item) return;

    const defaultStartDate = toDateInputValue(item.createdAt) || toDateInputValue(new Date().toISOString());

    setProjectName(item.suggestedProjectName || item.businessObjective || "");
    setPriority(mapUrgencyToPriority(item.urgency));
    setProjectType("transformation");
    setProjectManager("");
    setEstimatedBudget(getBudgetPrefillValue(item));
    setTargetDate(deriveTargetDate(defaultStartDate, item.expectedTimeline));
    setStrategicObjective(item.businessObjective || "");
  }, [open, item]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Send className="h-5 w-5 text-primary" />
            {t('portfolio.gateway.submitForPmoApproval')}
          </DialogTitle>
          <DialogDescription>
            {t('portfolio.gateway.submitPmoDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Source Demand Summary */}
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{t('portfolio.gateway.sourceDemand')}</p>
                <p className="text-sm text-muted-foreground mt-1">{item.businessObjective}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {item.organizationName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    {t('portfolio.gateway.alignLabel')}: {item.strategicAlignment || 0}%
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {item.workflowStatus === 'manager_approved' ? t('portfolio.gateway.managerApproved') :
                     item.workflowStatus === 'pending_conversion' ? t('portfolio.gateway.pendingConversion') : t('portfolio.gateway.initiallyApproved')}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Workspace Path */}
          <div className={`p-4 rounded-lg border-2 ${
            workspacePath === 'accelerator'
              ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30'
              : 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/30'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                workspacePath === 'accelerator'
                  ? 'bg-gradient-to-br from-purple-600 to-pink-600'
                  : 'bg-gradient-to-br from-blue-600 to-indigo-600'
              }`}>
                {workspacePath === 'accelerator' ? (
                  <Rocket className="h-5 w-5 text-white" />
                ) : (
                  <Briefcase className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {workspacePath === 'accelerator' ? t('portfolio.gateway.pathAccelerator') : t('portfolio.gateway.pathStandard')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {workspacePath === 'accelerator'
                    ? t('portfolio.gateway.pathAcceleratorDesc')
                    : t('portfolio.gateway.pathStandardDesc')}
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto">
                {workspacePath === 'accelerator' ? t('portfolio.gateway.timeline13Months') : t('portfolio.gateway.timeline6Months')}
              </Badge>
            </div>
          </div>

          {/* Project Details Section */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              {t('portfolio.gateway.projectDetails')}
            </h4>

            <div className="space-y-2">
              <Label htmlFor="projectName">{t('portfolio.gateway.projectName')}</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={item.businessObjective ? item.businessObjective.substring(0, 50) + '...' : ''}
                data-testid="input-project-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('portfolio.gateway.priorityLevel')}</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">{t('portfolio.gateway.priorityCritical')}</SelectItem>
                    <SelectItem value="high">{t('portfolio.gateway.priorityHigh')}</SelectItem>
                    <SelectItem value="medium">{t('portfolio.gateway.priorityMedium')}</SelectItem>
                    <SelectItem value="low">{t('portfolio.gateway.priorityLow')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('portfolio.gateway.projectCategory')}</Label>
                <Select value={projectType} onValueChange={setProjectType}>
                  <SelectTrigger data-testid="select-project-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transformation">{t('portfolio.gateway.catTransformation')}</SelectItem>
                    <SelectItem value="enhancement">{t('portfolio.gateway.catEnhancement')}</SelectItem>
                    <SelectItem value="maintenance">{t('portfolio.gateway.catMaintenance')}</SelectItem>
                    <SelectItem value="innovation">{t('portfolio.gateway.catInnovation')}</SelectItem>
                    <SelectItem value="compliance">{t('portfolio.gateway.catCompliance')}</SelectItem>
                    <SelectItem value="infrastructure">{t('portfolio.gateway.catInfrastructure')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="strategicObjective">{t('portfolio.gateway.strategicObjectiveLabel')}</Label>
              <Textarea
                id="strategicObjective"
                value={strategicObjective}
                onChange={(e) => setStrategicObjective(e.target.value)}
                placeholder={t('portfolio.gateway.strategicObjectivePlaceholder')}
                className="h-20"
                data-testid="input-strategic-objective"
              />
            </div>
          </div>

          {/* Resource Allocation */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              {t('portfolio.gateway.resourceAllocation')}
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="projectManager">{t('portfolio.gateway.projectManagerLabel')}</Label>
                <Input
                  id="projectManager"
                  value={projectManager}
                  onChange={(e) => setProjectManager(e.target.value)}
                  placeholder={t('portfolio.gateway.projectManagerPlaceholder')}
                  data-testid="input-project-manager"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedBudget">{t('portfolio.gateway.estimatedBudgetLabel')}</Label>
                <Input
                  id="estimatedBudget"
                  value={estimatedBudget}
                  onChange={(e) => setEstimatedBudget(e.target.value)}
                  placeholder={item.budgetRange || t('portfolio.gateway.estimatedBudgetPlaceholder')}
                  data-testid="input-estimated-budget"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetDate">{t('portfolio.gateway.targetCompletionDate')}</Label>
              <Input
                id="targetDate"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                data-testid="input-target-date"
              />
            </div>
          </div>

          {/* PMO Approval Notice */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <Send className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-400">{t('portfolio.gateway.pmoApprovalRequired')}</p>
                <p className="text-blue-700 dark:text-blue-500 mt-1">
                  {t('portfolio.gateway.pmoApprovalRequiredDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending} data-testid="button-cancel-convert">
            {t('portfolio.gateway.cancel')}
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                demandReportId: item.id,
                projectName: projectName || item.businessObjective?.substring(0, 100),
                priority,
                projectType,
                projectManager,
                estimatedBudget,
                targetDate,
                strategicObjective,
                workspacePath,
              })
            }
            disabled={isPending}
            className="gap-2"
            data-testid="button-confirm-convert"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('portfolio.gateway.submitForPmoApproval')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RejectDemandDialog({
  open,
  onOpenChange,
  item,
  reason,
  onReasonChange,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PipelineItem | null;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            {t('portfolio.gateway.rejectDemand')}
          </DialogTitle>
          <DialogDescription>
            {t('portfolio.gateway.rejectDemandDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Demand Info */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{item.organizationName}</span>
              </div>
              <p className="text-sm text-muted-foreground">{item.businessObjective}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                <span>{t('portfolio.gateway.alignLabel')}: {item.strategicAlignment || 0}%</span>
                <span>{t('portfolio.gateway.budgetLabel')}: {extractBudgetRange(item.budgetRange)}</span>
              </div>
            </div>
          </div>

          {/* Rejection Reason */}
          <div className="space-y-2">
            <Label htmlFor="rejectReason">{t('portfolio.gateway.rejectionReasonLabel')}</Label>
            <Select value={reason.split(':')[0] || ""} onValueChange={(v) => onReasonChange(v)}>
              <SelectTrigger data-testid="select-rejection-reason">
                <SelectValue placeholder={t('portfolio.gateway.selectRejectionReason')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="insufficient_alignment">{t('portfolio.gateway.rejectInsufficientAlignment')}</SelectItem>
                <SelectItem value="budget_constraints">{t('portfolio.gateway.rejectBudgetConstraints')}</SelectItem>
                <SelectItem value="duplicate_initiative">{t('portfolio.gateway.rejectDuplicateInitiative')}</SelectItem>
                <SelectItem value="incomplete_requirements">{t('portfolio.gateway.rejectIncompleteRequirements')}</SelectItem>
                <SelectItem value="low_priority">{t('portfolio.gateway.rejectLowPriority')}</SelectItem>
                <SelectItem value="technical_feasibility">{t('portfolio.gateway.rejectTechnicalFeasibility')}</SelectItem>
                <SelectItem value="resource_unavailable">{t('portfolio.gateway.rejectResourceUnavailable')}</SelectItem>
                <SelectItem value="other">{t('portfolio.gateway.rejectOther')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalNotes">{t('portfolio.gateway.additionalNotes')}</Label>
            <Textarea
              id="additionalNotes"
              placeholder={t('portfolio.gateway.additionalNotesPlaceholder')}
              className="h-24"
              data-testid="input-rejection-notes"
            />
          </div>

          {/* Warning */}
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">
                {t('portfolio.gateway.rejectWarning')}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending} data-testid="button-cancel-reject">
            {t('portfolio.gateway.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending || !reason}
            className="gap-2"
            data-testid="button-confirm-reject"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            {t('portfolio.gateway.confirmRejection')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
