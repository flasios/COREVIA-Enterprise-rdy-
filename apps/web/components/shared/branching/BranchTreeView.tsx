import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GitBranch,
  GitMerge,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  User,
  Calendar,
  GitCommit,
  Trash2
} from "lucide-react";
import { useBranchTree, useDeleteBranch, type BranchTreeNode } from "@/hooks/useBranches";
import { format } from "date-fns";
import { Can } from "@/components/auth/Can";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BranchTreeViewProps {
  reportId: string;
  onBranchSelect?: (branchId: string) => void;
  onBranchDetails?: (branchId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG = {
  active: {
    label: "Active",
    variant: "default" as const,
    icon: GitBranch,
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
  },
  merged: {
    label: "Merged",
    variant: "default" as const,
    icon: CheckCircle,
    className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
  },
  abandoned: {
    label: "Abandoned",
    variant: "outline" as const,
    icon: XCircle,
    className: "bg-muted text-muted-foreground"
  }
};

interface BranchNodeProps {
  branch: BranchTreeNode;
  level: number;
  onBranchSelect?: (branchId: string) => void;
  onDelete?: (branchId: string) => void;
}

function BranchNode({ branch, level, onBranchSelect, onDelete }: BranchNodeProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = branch.children && branch.children.length > 0;
  const statusConfig = STATUS_CONFIG[branch.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className="relative"
      data-testid={`tree-branch-${branch.id}`}
    >
      {/* Connecting Lines */}
      {level > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 w-px bg-border"
          style={{ left: `${(level - 1) * 24 + 12}px` }}
        />
      )}
      {level > 0 && (
        <div
          className="absolute left-0 top-6 h-px bg-border"
          style={{
            left: `${(level - 1) * 24 + 12}px`,
            width: "12px"
          }}
        />
      )}

      {/* Branch Node */}
      <div
        className="flex items-start gap-2 py-2 px-3 rounded-md hover-elevate active-elevate-2 cursor-pointer"
        style={{ marginLeft: `${level * 24}px` }}
        onClick={() => onBranchSelect?.(branch.id)}
      >
        {/* Expand/Collapse Button */}
        <div className="flex-shrink-0 mt-0.5">
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              data-testid={`button-toggle-branch-${branch.id}`}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : (
            <div className="h-5 w-5" />
          )}
        </div>

        {/* Branch Icon */}
        <StatusIcon className="h-4 w-4 mt-1 flex-shrink-0" />

        {/* Branch Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{branch.name}</span>
            <Badge className={`h-5 ${statusConfig.className}`}>
              {t(`versioning.branchTree.status_${branch.status}`)}
            </Badge>
          </div>

          {branch.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {branch.description}
            </p>
          )}

          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {branch.createdByName && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{branch.createdByName}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(branch.createdAt), "MMM d, yyyy")}</span>
            </div>
            {branch.headVersion && (
              <div className="flex items-center gap-1">
                <GitCommit className="h-3 w-3" />
                <span>{branch.headVersion.versionNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* Delete Button */}
        <Can permissions={["version:create"]}>
          {branch.status !== "merged" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(branch.id);
              }}
              data-testid={`button-delete-branch-${branch.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </Can>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-1">
          {branch.children!.map((child) => (
            <BranchNode
              key={child.id}
              branch={child}
              level={level + 1}
              onBranchSelect={onBranchSelect}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BranchTreeView({
  reportId,
  onBranchSelect,

  onBranchDetails: _onBranchDetails,
  open,
  onOpenChange
}: BranchTreeViewProps) {
  const { t } = useTranslation();
  const { data: branchTree, isLoading, isError: _isError } = useBranchTree(reportId);
  const deleteBranchMutation = useDeleteBranch(reportId);
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);

  const handleBranchSelect = (branchId: string) => {
    onBranchSelect?.(branchId);
    onOpenChange(false);
  };

  const handleDeleteConfirm = async () => {
    if (branchToDelete) {
      await deleteBranchMutation.mutateAsync(branchToDelete);
      setBranchToDelete(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-primary" />
              {t('versioning.branchTree.title')}
            </DialogTitle>
            <DialogDescription>
              {t('versioning.branchTree.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full ml-6" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : branchTree && branchTree.length > 0 ? (
              <div className="space-y-2">
                {/* Main Branch (virtual root) */}
                <div
                  className="flex items-start gap-2 py-3 px-3 rounded-md border-2 border-primary/20 bg-primary/5 hover-elevate active-elevate-2 cursor-pointer"
                  onClick={() => {
                    onBranchSelect?.(null as unknown as string); // Switch to main
                    onOpenChange(false);
                  }}
                  data-testid="tree-branch-main"
                >
                  <GitBranch className="h-4 w-4 mt-1 flex-shrink-0 text-primary" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{t('versioning.branchTree.mainBranch')}</span>
                      <Badge variant="outline" className="h-5">
                        {t('versioning.branchTree.default')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('versioning.branchTree.primaryBranchDescription')}
                    </p>
                  </div>
                </div>

                {/* Branch Tree */}
                <div className="mt-4 space-y-1">
                  {branchTree.map((branch) => (
                    <BranchNode
                      key={branch.id}
                      branch={branch}
                      level={0}
                      onBranchSelect={handleBranchSelect}
                      onDelete={setBranchToDelete}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <GitBranch className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t('versioning.branchTree.noBranchesTitle')}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {t('versioning.branchTree.noBranchesDescription')}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!branchToDelete} onOpenChange={() => setBranchToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('versioning.branchTree.deleteBranchTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('versioning.branchTree.deleteBranchDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('versioning.branchTree.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('versioning.branchTree.deleteBranch')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
