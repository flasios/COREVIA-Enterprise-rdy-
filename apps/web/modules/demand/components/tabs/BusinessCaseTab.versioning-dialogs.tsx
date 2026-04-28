import { CreateVersionDialog, VersionDetailView, VersionRestoreDialog } from "@/components/shared/versioning";
import { BranchTreeView, MergeDialog } from "@/components/shared/branching";
import type { FinancialEditData } from "@/modules/demand/business-case/financial";
import type { ReportVersion } from "@shared/schema";
import type { BusinessCaseData } from "../business-case";

interface BusinessCaseVersioningDialogsProps {
  reportId: string;
  businessCaseId?: string | number;
  editedData: BusinessCaseData | null;
  financialEditData: FinancialEditData | null;
  getLatestFinancialEditData?: () => FinancialEditData | null;
  preparedEditedContent?: Record<string, unknown> | null;
  versionScopeKey?: 'pilot' | 'full';
  versionScopeLabel?: string;
  showVersionDialog: boolean;
  onVersionDialogOpenChange: (open: boolean) => void;
  initialChangesSummary: string;
  onVersionCreated: () => void | Promise<void>;
  showVersionDetail: boolean;
  selectedVersionForDetail: ReportVersion | null;
  onCloseVersionDetail: () => void;
  showRestoreDialog: boolean;
  selectedVersionForRestore: ReportVersion | null;
  latestVersion: ReportVersion | null | undefined;
  onCloseRestoreDialog: () => void;
  onConfirmRestore: (versionId: string) => void;
  isRestoring: boolean;
  conflictWarnings: string[];
  isVersionLocked: boolean;
  showBranchTree: boolean;
  onBranchTreeOpenChange: (open: boolean) => void;
  onBranchSelect: (branchId: string) => void;
  showMergeDialog: boolean;
  onMergeDialogOpenChange: (open: boolean) => void;
  selectedBranchId: string | null;
  onMergeComplete: () => void;
}

export function BusinessCaseVersioningDialogs({
  reportId,
  businessCaseId,
  editedData,
  financialEditData,
  getLatestFinancialEditData,
  preparedEditedContent,
  versionScopeKey,
  versionScopeLabel,
  showVersionDialog,
  onVersionDialogOpenChange,
  initialChangesSummary,
  onVersionCreated,
  showVersionDetail,
  selectedVersionForDetail,
  onCloseVersionDetail,
  showRestoreDialog,
  selectedVersionForRestore,
  latestVersion,
  onCloseRestoreDialog,
  onConfirmRestore,
  isRestoring,
  conflictWarnings,
  isVersionLocked,
  showBranchTree,
  onBranchTreeOpenChange,
  onBranchSelect,
  showMergeDialog,
  onMergeDialogOpenChange,
  selectedBranchId,
  onMergeComplete,
}: BusinessCaseVersioningDialogsProps) {
  const resolvedFinancialEditData = getLatestFinancialEditData?.() ?? financialEditData;
  const editedContent = preparedEditedContent ?? {
    ...editedData,
    ...(versionScopeKey ? { _businessCaseViewScope: versionScopeKey } : {}),
    ...(versionScopeLabel ? { _businessCaseViewScopeLabel: versionScopeLabel } : {}),
    ...(resolvedFinancialEditData?.hasChanges && {
      totalCostEstimate: resolvedFinancialEditData.totalCostEstimate,
      savedFinancialAssumptions: resolvedFinancialEditData.financialAssumptions,
      savedDomainParameters: resolvedFinancialEditData.domainParameters,
      aiRecommendedBudget: resolvedFinancialEditData.aiRecommendedBudget,
      costOverrides: resolvedFinancialEditData.costOverrides ?? {},
      benefitOverrides: resolvedFinancialEditData.benefitOverrides ?? {},
      _hasFinancialChanges: true,
    }),
  };

  return (
    <>
      {showVersionDialog && (
        <CreateVersionDialog
          reportId={reportId}
          businessCaseId={businessCaseId != null ? String(businessCaseId) : undefined}
          editedContent={editedContent}
          open={showVersionDialog}
          onOpenChange={onVersionDialogOpenChange}
          initialChangesSummary={initialChangesSummary}
          onVersionCreated={onVersionCreated}
        />
      )}

      {showVersionDetail && selectedVersionForDetail && (
        <VersionDetailView
          open={showVersionDetail}
          onClose={onCloseVersionDetail}
          version={selectedVersionForDetail}
        />
      )}

      {showRestoreDialog && (
        <VersionRestoreDialog
          open={showRestoreDialog}
          onClose={onCloseRestoreDialog}
          version={selectedVersionForRestore}
          currentVersion={latestVersion ?? null}
          onConfirmRestore={onConfirmRestore}
          isRestoring={isRestoring}
          conflictWarnings={conflictWarnings}
          isLocked={isVersionLocked}
          lockedBy={selectedVersionForRestore?.createdByName}
        />
      )}

      {showBranchTree && (
        <BranchTreeView
          reportId={reportId}
          open={showBranchTree}
          onOpenChange={onBranchTreeOpenChange}
          onBranchSelect={onBranchSelect}
        />
      )}

      {showMergeDialog && (
        <MergeDialog
          reportId={reportId}
          open={showMergeDialog}
          onOpenChange={onMergeDialogOpenChange}
          defaultSourceBranchId={selectedBranchId || undefined}
          onMergeComplete={onMergeComplete}
        />
      )}
    </>
  );
}
