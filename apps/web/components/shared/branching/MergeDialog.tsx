import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GitMerge,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  FileText
} from "lucide-react";
import { useBranches, useMergeBranches, type VersionBranch } from "@/hooks/useBranches";
import { useTranslation } from 'react-i18next';
import { useQuery } from "@tanstack/react-query";
import type { ReportVersion } from "@shared/schema";
import { VersionDiffViewer } from "@/components/shared/versioning";

interface MergeDialogProps {
  reportId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSourceBranchId?: string;
  onMergeComplete?: () => void;
}

export function MergeDialog({
  reportId,
  open,
  onOpenChange,
  defaultSourceBranchId,
  onMergeComplete
}: MergeDialogProps) {
  const [sourceBranchId, setSourceBranchId] = useState<string>(defaultSourceBranchId || "");
  const [targetBranchId, setTargetBranchId] = useState<string>("");
  const [mergeMessage, setMergeMessage] = useState("");
  const { t } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [conflicts, setConflicts] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resolutions, setResolutions] = useState<Record<string, any>>({});

  const { data: branches, isLoading: branchesLoading, isError: _branchesError } = useBranches(reportId);
  const mergeMutation = useMergeBranches(reportId, sourceBranchId);

  // Safe default to empty array if error or no data - handle API response format
  const safeBranches: VersionBranch[] = Array.isArray(branches)
    ? branches
    : ((branches as Record<string, unknown> | undefined)?.data as VersionBranch[] | undefined) || [];

  // Get versions for diff preview
  const { data: versionsResponse } = useQuery<{ data: ReportVersion[] }>({
    queryKey: ['/api/demand-reports', reportId, 'versions'],
    enabled: open && !!reportId,
  });

  const versions = versionsResponse?.data || [];

  // Find head versions for source and target branches
  const sourceBranch = safeBranches.find((b: VersionBranch) => b.id === sourceBranchId);
  const targetBranch = safeBranches.find((b: VersionBranch) => b.id === targetBranchId);
  const sourceVersion = sourceBranch?.headVersionId 
    ? versions.find(v => v.id === sourceBranch.headVersionId)
    : undefined;
  const targetVersion = targetBranch?.headVersionId
    ? versions.find(v => v.id === targetBranch.headVersionId)
    : undefined;

  const canMerge = sourceBranchId && targetBranchId && sourceBranchId !== targetBranchId;
  const showPreview = canMerge && sourceVersion && targetVersion;

  const handleMerge = async () => {
    if (!canMerge) return;

    try {
      const result = await mergeMutation.mutateAsync({
        targetBranchId,
        resolutions: Object.keys(resolutions).length > 0 ? resolutions : undefined,
        mergeMessage: mergeMessage.trim() || undefined,
      });

      // Check for conflicts in response
      if (result.data?.conflicts && result.data.conflicts.length > 0) {
        setConflicts(result.data.conflicts);
      } else {
        // Merge successful
        onOpenChange(false);
        onMergeComplete?.();
        
        // Reset state
        setSourceBranchId("");
        setTargetBranchId("");
        setMergeMessage("");
        setConflicts([]);
        setResolutions({});
      }
    } catch (error) {
      console.error("Merge error:", error);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleConflictResolution = (field: string, value: any) => {
    setResolutions(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col" data-testid="dialog-merge-branch">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            {t('versioning.mergeDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('versioning.mergeDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Branch Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source-branch">
                {t('versioning.mergeDialog.sourceBranch')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={sourceBranchId}
                onValueChange={setSourceBranchId}
                disabled={branchesLoading}
              >
                <SelectTrigger id="source-branch" data-testid="select-source-branch">
                  <SelectValue placeholder={t('versioning.mergeDialog.selectSourceBranch')} />
                </SelectTrigger>
                <SelectContent>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {safeBranches.filter((b: any) => b.status === "active").map((branch: any) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      <div className="flex items-center gap-2">
                        <span>{branch.name}</span>
                        {branch.headVersionId && (
                          <Badge variant="outline" className="h-5 text-xs">
                            {versions.find(v => v.id === branch.headVersionId)?.versionNumber || t('versioning.mergeDialog.noVersions')}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sourceBranch && (
                <p className="text-xs text-muted-foreground">
                  {sourceBranch.description || t('versioning.mergeDialog.noDescription')}
                </p>
              )}
            </div>

            <div className="flex items-center justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-branch">
                {t('versioning.mergeDialog.targetBranch')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={targetBranchId}
                onValueChange={setTargetBranchId}
                disabled={branchesLoading || !sourceBranchId}
              >
                <SelectTrigger id="target-branch" data-testid="select-target-branch">
                  <SelectValue placeholder={t('versioning.mergeDialog.selectTargetBranch')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('versioning.mergeDialog.mainBranch')}</span>
                      <Badge variant="outline" className="h-5 text-xs">
                        {t('versioning.mergeDialog.default')}
                      </Badge>
                    </div>
                  </SelectItem>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {safeBranches.filter((b: any) => b.status === "active" && b.id !== sourceBranchId).map((branch: any) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      <div className="flex items-center gap-2">
                        <span>{branch.name}</span>
                        {branch.headVersionId && (
                          <Badge variant="outline" className="h-5 text-xs">
                            {versions.find(v => v.id === branch.headVersionId)?.versionNumber || t('versioning.mergeDialog.noVersions')}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {targetBranch && (
                <p className="text-xs text-muted-foreground">
                  {targetBranch.description || t('versioning.mergeDialog.noDescription')}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Merge Message */}
          <div className="space-y-2">
            <Label htmlFor="merge-message">{t('versioning.mergeDialog.mergeMessageLabel')}</Label>
            <Textarea
              id="merge-message"
              placeholder={t('versioning.mergeDialog.mergeMessagePlaceholder')}
              value={mergeMessage}
              onChange={(e) => setMergeMessage(e.target.value)}
              rows={2}
              data-testid="textarea-merge-message"
            />
          </div>

          {/* Conflicts Section */}
          {conflicts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span className="font-semibold">
                  {t('versioning.mergeDialog.conflictsDetected', { count: conflicts.length })}
                </span>
              </div>

              <div className="space-y-3 border rounded-lg p-4 bg-amber-50 dark:bg-amber-950/20">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {conflicts.map((conflict: any, idx: number) => (
                  <div key={idx} className="space-y-2 pb-3 border-b last:border-b-0">
                    <h4 className="font-medium text-sm">{conflict.field}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('versioning.mergeDialog.sourceValue')}</Label>
                        <div className="p-2 bg-background rounded border text-sm">
                          {String(conflict.sourceValue || "—")}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('versioning.mergeDialog.targetValue')}</Label>
                        <div className="p-2 bg-background rounded border text-sm">
                          {String(conflict.targetValue || "—")}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={resolutions[conflict.field] === conflict.sourceValue ? "default" : "outline"}
                        onClick={() => handleConflictResolution(conflict.field, conflict.sourceValue)}
                        data-testid={`button-resolve-source-${idx}`}
                      >
                        {t('versioning.mergeDialog.useSource')}
                      </Button>
                      <Button
                        size="sm"
                        variant={resolutions[conflict.field] === conflict.targetValue ? "default" : "outline"}
                        onClick={() => handleConflictResolution(conflict.field, conflict.targetValue)}
                        data-testid={`button-resolve-target-${idx}`}
                      >
                        {t('versioning.mergeDialog.useTarget')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Section */}
          {showPreview && (
            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preview">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  {t('versioning.mergeDialog.changesPreview')}
                </TabsTrigger>
                <TabsTrigger value="summary">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  {t('versioning.mergeDialog.summary')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="mt-4">
                <VersionDiffViewer
                  versionA={targetVersion}
                  versionB={sourceVersion}
                  onClose={() => {}}
                />
              </TabsContent>
              <TabsContent value="summary" className="mt-4">
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <GitMerge className="h-5 w-5 mt-0.5 text-primary" />
                    <div className="space-y-1">
                      <h4 className="font-semibold">{t('versioning.mergeDialog.mergeSummary')}</h4>
                      <p className="text-sm text-muted-foreground">
                        Merging <strong>{sourceBranch?.name}</strong> ({sourceVersion.versionNumber}) 
                        into <strong>{targetBranch ? targetBranch.name : "Main Branch"}</strong> 
                        {targetVersion && ` (${targetVersion.versionNumber})`}
                      </p>
                    </div>
                  </div>
                  {conflicts.length === 0 && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">{t('versioning.mergeDialog.noConflicts')}</span>
                    </div>
                  )}
                  {conflicts.length > 0 && (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {t('versioning.mergeDialog.resolveConflicts', { count: conflicts.filter(c => !resolutions[c.field]).length })}
                      </span>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          {!canMerge && (
            <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                {!sourceBranchId || !targetBranchId 
                  ? t('versioning.mergeDialog.selectBothBranches')
                  : t('versioning.mergeDialog.branchesMustDiffer')
                }
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mergeMutation.isPending}
            data-testid="button-cancel-merge"
          >
            {t('versioning.mergeDialog.cancel')}
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!canMerge || mergeMutation.isPending || (conflicts.length > 0 && Object.keys(resolutions).length < conflicts.length)}
            data-testid="button-submit-merge"
          >
            {mergeMutation.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            <GitMerge className="w-4 h-4 mr-2" />
            {t('versioning.mergeDialog.mergeBranches')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
