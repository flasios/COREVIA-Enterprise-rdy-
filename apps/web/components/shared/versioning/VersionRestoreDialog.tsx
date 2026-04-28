import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  FileText as _FileText,
  Lock
} from "lucide-react";
import type { ReportVersion } from "@shared/schema";
import { useTranslation } from 'react-i18next';
import { format } from "date-fns";

interface VersionRestoreDialogProps {
  open: boolean;
  onClose: () => void;
  version: ReportVersion | null;
  currentVersion: ReportVersion | null;
  onConfirmRestore: (versionId: string) => void;
  isRestoring: boolean;
  conflictWarnings?: string[];
  isLocked?: boolean;
  lockedBy?: string;
}

export default function VersionRestoreDialog({
  open,
  onClose,
  version,
  currentVersion,
  onConfirmRestore,
  isRestoring,
  conflictWarnings = [],
  isLocked = false,
  lockedBy
}: VersionRestoreDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const { t } = useTranslation();

  if (!version) return null;

  const hasConflicts = conflictWarnings.length > 0 || isLocked;
  const canRestore = !hasConflicts && !isRestoring;
  const requiresConfirmation = true; // Always require typing confirmation

  const handleConfirm = () => {
    if (confirmText.toLowerCase() === "restore" && canRestore) {
      onConfirmRestore(version.id);
      setConfirmText("");
    }
  };

  const versionData = version.versionData as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const currentData = currentVersion?.versionData as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Calculate key changes
  const changes = {
    budget: versionData?.estimatedBudget !== currentData?.estimatedBudget,
    timeline: versionData?.estimatedTimeline !== currentData?.estimatedTimeline,
    objective: versionData?.businessObjective !== currentData?.businessObjective,
    stakeholders: JSON.stringify(versionData?.stakeholders) !== JSON.stringify(currentData?.stakeholders)
  };

  const hasChanges = Object.values(changes).some(c => c);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-amber-500" />
            {t('versioning.restoreDialog.title', { version: version.versionNumber })}
          </DialogTitle>
          <DialogDescription>
            {t('versioning.restoreDialog.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Conflict Warnings */}
        {isLocked && (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              <strong>{t('versioning.restoreDialog.versionLocked')}:</strong> {t('versioning.restoreDialog.versionLockedDesc', { user: lockedBy || t('versioning.restoreDialog.anotherUser') })}
            </AlertDescription>
          </Alert>
        )}

        {conflictWarnings.map((warning, i) => (
          <Alert key={i} variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        ))}

        {/* Version Details */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">{t('versioning.restoreDialog.tabDetails')}</TabsTrigger>
            <TabsTrigger value="changes">{t('versioning.restoreDialog.tabImpact')}</TabsTrigger>
            <TabsTrigger value="preview">{t('versioning.restoreDialog.tabPreview')}</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('versioning.restoreDialog.version')}</label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{version.versionNumber}</Badge>
                  <Badge variant="secondary">{version.status}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('versioning.restoreDialog.created')}</label>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {format(new Date(version.createdAt), "PPp")}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('versioning.restoreDialog.createdBy')}</label>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {version.createdByName}
                  {version.createdByRole && (
                    <Badge variant="outline" className="h-4 text-[10px]">{version.createdByRole}</Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('versioning.restoreDialog.status')}</label>
                <div className="flex items-center gap-2 text-sm">
                  {version.status === "published" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                  {version.status === "rejected" && <XCircle className="h-3.5 w-3.5 text-rose-500" />}
                  {version.status}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">{t('versioning.restoreDialog.changeSummary')}</label>
              <p className="text-sm border rounded-md p-3 bg-muted/50">{version.changesSummary}</p>
            </div>

            {version.editReason && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('versioning.restoreDialog.editReason')}</label>
                <p className="text-sm border rounded-md p-3 bg-muted/50">{version.editReason}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="changes" className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('versioning.restoreDialog.restoreWarning', { version: version.versionNumber })}
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">{t('versioning.restoreDialog.fieldsWillChange')}</h4>
              {!hasChanges ? (
                <p className="text-sm text-muted-foreground">{t('versioning.restoreDialog.noSignificantChanges')}</p>
              ) : (
                <div className="space-y-2">
                  {changes.budget && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <span>{t('versioning.restoreDialog.budgetWillChange')}</span>
                    </div>
                  )}
                  {changes.timeline && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <span>{t('versioning.restoreDialog.timelineWillChange')}</span>
                    </div>
                  )}
                  {changes.objective && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <span>{t('versioning.restoreDialog.objectiveWillChange')}</span>
                    </div>
                  )}
                  {changes.stakeholders && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <span>{t('versioning.restoreDialog.stakeholdersWillChange')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <div className="max-h-[400px] overflow-y-auto space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('versioning.restoreDialog.businessObjective')}</label>
                <div className="text-sm border rounded-md p-3 bg-card">
                  {versionData?.businessObjective || t('versioning.restoreDialog.notSpecified')}
                </div>
              </div>

              {versionData?.estimatedBudget && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('versioning.restoreDialog.budget')}</label>
                  <div className="text-sm border rounded-md p-3 bg-card">
                    {versionData.estimatedBudget}
                  </div>
                </div>
              )}

              {versionData?.estimatedTimeline && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('versioning.restoreDialog.timeline')}</label>
                  <div className="text-sm border rounded-md p-3 bg-card">
                    {versionData.estimatedTimeline}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Confirmation Input */}
        {requiresConfirmation && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('versioning.restoreDialog.typeRestoreConfirm')}</label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={t('versioning.restoreDialog.typeRestorePlaceholder')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canRestore}
              data-testid="input-confirm-restore"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isRestoring}>
            {t('versioning.restoreDialog.cancel')}
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={!canRestore || confirmText.toLowerCase() !== "restore"}
            data-testid="button-confirm-restore"
          >
            {isRestoring ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                {t('versioning.restoreDialog.restoring')}
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                {t('versioning.restoreDialog.restoreVersion')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
