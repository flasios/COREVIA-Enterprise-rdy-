import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

function isNoChangesSummary(value: string): boolean {
  return value.trim().toLowerCase() === 'no changes detected';
}

function hasFinancialChangesFlag(value: unknown): boolean {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as Record<string, unknown>)._hasFinancialChanges,
  );
}

function getBusinessCaseScopeLabel(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const scopeLabel = (value as Record<string, unknown>)._businessCaseViewScopeLabel;
  if (typeof scopeLabel === 'string' && scopeLabel.trim().length > 0) {
    return scopeLabel.trim();
  }

  const scopeKey = (value as Record<string, unknown>)._businessCaseViewScope;
  if (scopeKey === 'pilot') return 'Pilot business case';
  if (scopeKey === 'full') return 'Full commercial business case';
  return null;
}

function applyScopePrefix(summary: string, scopeLabel: string | null): string {
  const trimmedSummary = summary.trim();
  if (!scopeLabel) return trimmedSummary;
  if (!trimmedSummary) return `${scopeLabel}:`;
  if (trimmedSummary.toLowerCase().startsWith(scopeLabel.toLowerCase())) {
    return trimmedSummary;
  }
  return `${scopeLabel}: ${trimmedSummary}`;
}

interface CreateVersionDialogProps {
  reportId: string;
  businessCaseId?: string;
  editedContent?: unknown;
  contentType?: 'business_case' | 'requirements' | 'enterprise_architecture' | 'strategic_fit'; // NEW: determines what type of version to create
  onVersionCreated?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  initialChangesSummary?: string;
}

export function CreateVersionDialog({ 
  reportId,
  businessCaseId,
  editedContent,
  contentType = 'business_case', // Default to business_case for backward compatibility
  onVersionCreated,
  open: controlledOpen,
  onOpenChange,
  trigger,
  initialChangesSummary = ""
}: CreateVersionDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [versionType, setVersionType] = useState<"major" | "minor" | "patch">("minor");
  const [changesSummary, setChangesSummary] = useState(initialChangesSummary);
  const [editReason, setEditReason] = useState("");
  const { toast } = useToast();
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const businessCaseScopeLabel = useMemo(() => getBusinessCaseScopeLabel(editedContent), [editedContent]);

  const normalizedInitialChangesSummary = useMemo(() => {
    if (hasFinancialChangesFlag(editedContent) && (!initialChangesSummary.trim() || isNoChangesSummary(initialChangesSummary))) {
      return applyScopePrefix('Updated financial model assumptions and overrides', businessCaseScopeLabel);
    }
    return applyScopePrefix(initialChangesSummary, businessCaseScopeLabel);
  }, [businessCaseScopeLabel, editedContent, initialChangesSummary]);

  const hasDetectedEdits = useMemo(() => {
    if (typeof normalizedInitialChangesSummary === 'string' && normalizedInitialChangesSummary.trim().length > 0) {
      return true;
    }
    return editedContent !== undefined;
  }, [editedContent, normalizedInitialChangesSummary]);

  const [useAiSummary, setUseAiSummary] = useState(!hasDetectedEdits);

  const dialogCopy = useMemo(() => {
    const contentLabel = contentType === 'requirements'
      ? t('versioning.createVersion.requirementsLabel')
      : contentType === 'enterprise_architecture'
        ? t('versioning.createVersion.enterpriseArchitectureLabel')
        : contentType === 'strategic_fit'
          ? t('versioning.createVersion.strategicFitLabel')
          : t('versioning.createVersion.businessCaseLabel');

    return {
      title: t('versioning.createVersion.dialogTitle', { content: contentLabel }),
      description: t('versioning.createVersion.dialogDescription', { content: contentLabel.toLowerCase() }),
    };
  }, [contentType, t]);

  // Keep the summary field aligned with late-arriving detected edits, especially
  // financial-only edits that may reach the dialog a moment after it opens.
  useEffect(() => {
    if (!controlledOpen) return;

    if (normalizedInitialChangesSummary) {
      setChangesSummary((current) => {
        if (!current.trim() || isNoChangesSummary(current)) {
          return normalizedInitialChangesSummary;
        }
        return current;
      });
    }

    setUseAiSummary(!hasDetectedEdits);
  }, [controlledOpen, hasDetectedEdits, normalizedInitialChangesSummary]);

  // Support both controlled and uncontrolled modes
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };

  const handleCreate = async () => {
    // Validate based on AI summary toggle
    if (!useAiSummary && !changesSummary.trim()) {
      toast({
        title: t('versioning.createVersion.missingInformation'),
        description: t('versioning.createVersion.provideSummary'),
        variant: "destructive",
      });
      return;
    }

    if (!currentUser) {
      toast({
        title: t('versioning.createVersion.error'),
        description: t('versioning.createVersion.userNotAvailable'),
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await apiRequest(
        "POST",
        `/api/demand-reports/${reportId}/versions`,
        {
          versionType,
          contentType, // NEW: tells backend whether this is business_case or requirements
          changesSummary: useAiSummary ? undefined : changesSummary.trim(), // Only send if not using AI
          skipAiSummary: !useAiSummary, // Tell backend whether to generate AI summary
          editReason: editReason.trim() || undefined,
          createdBy: currentUser.id,
          createdByName: currentUser.displayName,
          createdByRole: currentUser.role,
          businessCaseId,
          editedContent, // Send the edited content to be saved atomically with version
        }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: t('versioning.createVersion.versionCreated'),
          description: t('versioning.createVersion.versionCreatedDesc', { version: data.data.versionNumber }),
        });
        setOpen(false);
        setChangesSummary("");
        setEditReason("");
        setVersionType("minor");
        onVersionCreated?.();

        // Record edit feedback out-of-band so version creation is not blocked.
        void apiRequest('POST', '/api/intelligence/learning/feedback', {
          contentId: String(businessCaseId || reportId),
          contentType,
          userId: currentUser?.id,
          feedbackType: 'edit',
          originalContent: null,
          editedContent: JSON.stringify(editedContent),
          metadata: { reportId, versionNumber: data.data.versionNumber, changesSummary: changesSummary.trim() }
        }).catch((feedbackError) => {
          console.warn('[Learning] Failed to record edit feedback:', feedbackError);
        });
      } else {
        throw new Error(data.error || t('versioning.createVersion.failedToCreate'));
      }
    } catch (error) {
      console.error("Error creating version:", error);
      toast({
        title: t('versioning.createVersion.error'),
        description: error instanceof Error ? error.message : t('versioning.createVersion.failedToCreate'),
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-create-version">
        <DialogHeader>
          <DialogTitle>{dialogCopy.title}</DialogTitle>
          <DialogDescription>
            {dialogCopy.description}
          </DialogDescription>
          {businessCaseScopeLabel && (
            <div className="pt-2">
              <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200">
                Saving version for {businessCaseScopeLabel}
              </Badge>
            </div>
          )}
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="version-type">{t('versioning.createVersion.versionType')}</Label>
            <Select value={versionType} onValueChange={(value) => setVersionType(value as "major" | "minor" | "patch")}>
              <SelectTrigger id="version-type" data-testid="select-version-type">
                <SelectValue placeholder={t('versioning.createVersion.selectVersionType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="major">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{t('versioning.createVersion.majorLabel')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('versioning.createVersion.majorDescription')}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="minor">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{t('versioning.createVersion.minorLabel')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('versioning.createVersion.minorDescription')}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="patch">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{t('versioning.createVersion.patchLabel')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('versioning.createVersion.patchDescription')}
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between space-x-2 py-2 px-4 bg-muted/50 rounded-md">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <Label htmlFor="ai-summary-toggle" className="cursor-pointer text-sm font-medium">
                {t('versioning.createVersion.autoGenerateAI')}
              </Label>
            </div>
            <Switch
              id="ai-summary-toggle"
              checked={useAiSummary}
              onCheckedChange={setUseAiSummary}
              data-testid="switch-ai-summary"
            />
          </div>

          {!useAiSummary && (
            <div className="space-y-2">
              <Label htmlFor="changes-summary">
                {t('versioning.createVersion.changesSummary')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="changes-summary"
                placeholder={t('versioning.createVersion.changesSummaryPlaceholder')}
                value={changesSummary}
                onChange={(e) => setChangesSummary(e.target.value)}
                data-testid="input-changes-summary"
              />
            </div>
          )}

          {useAiSummary && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
              <div className="flex items-start space-x-2">
                <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-primary">{t('versioning.createVersion.aiWillGenerate')}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {t('versioning.createVersion.aiDescription')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-reason">{t('versioning.createVersion.editReason')}</Label>
            <Textarea
              id="edit-reason"
              placeholder={t('versioning.createVersion.editReasonPlaceholder')}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              rows={3}
              data-testid="textarea-edit-reason"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isCreating}
            data-testid="button-cancel-version"
          >
            {t('versioning.createVersion.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || (!useAiSummary && !changesSummary.trim())}
            data-testid="button-confirm-create-version"
          >
            {isCreating && (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {useAiSummary ? t('versioning.createVersion.generatingWithAI') : t('versioning.createVersion.creating')}
              </>
            )}
            {!isCreating && (
              <>
                {useAiSummary && <Sparkles className="w-4 h-4 mr-2" />}
                {t('versioning.createVersion.createVersion')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
