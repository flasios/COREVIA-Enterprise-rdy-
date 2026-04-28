import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch } from "lucide-react";
import { useBranches } from "@/hooks/useBranches";
import { useTranslation } from 'react-i18next';

interface BranchSelectorProps {
  reportId: string;
  selectedBranchId?: string | null;
  onBranchChange: (branchId: string | null) => void;
  showCreateButton?: boolean;
}

export function BranchSelector({
  reportId,
  selectedBranchId,
  onBranchChange,
}: BranchSelectorProps) {
  const { t } = useTranslation();
  const { data: branches, isLoading } = useBranches(reportId);

  const handleBranchSelect = (value: string) => {
    if (value === "main") {
      onBranchChange(null);
    } else {
      onBranchChange(value);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-9 w-64" />;
  }

  // Safe branch list
  const safeBranches = Array.isArray(branches) ? branches : [];
  const selectedBranch = safeBranches.find((b) => b?.id === selectedBranchId);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedBranchId || "main"}
        onValueChange={handleBranchSelect}
      >
        <SelectTrigger 
          className="w-64" 
          data-testid="select-branch"
        >
          <SelectValue>
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5" />
              <span className="font-medium">
                {selectedBranch?.name || t('versioning.branchSelector.mainBranch')}
              </span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Main Branch */}
          <SelectItem value="main" data-testid="branch-option-main">
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5" />
              <span className="font-medium">{t('versioning.branchSelector.mainBranch')}</span>
              <Badge variant="outline" className="h-5 text-xs">
                {t('versioning.branchSelector.default')}
              </Badge>
            </div>
          </SelectItem>

          {/* Existing Branches */}
          {safeBranches.length > 0 && (
            <>
              <div className="my-1 h-px bg-border" />
              {safeBranches.map((branch) => {
                if (!branch || !branch.id) return null;
                
                return (
                  <SelectItem 
                    key={branch.id} 
                    value={branch.id}
                    data-testid={`branch-option-${branch.id}`}
                  >
                    <div className="flex items-center gap-2 py-1">
                      <GitBranch className="h-3.5 w-3.5" />
                      <span className="font-medium">{branch.name || t('versioning.branchSelector.unnamed')}</span>
                      <Badge variant="outline" className="h-5 text-xs">
                        {branch.status || "active"}
                      </Badge>
                    </div>
                  </SelectItem>
                );
              })}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
