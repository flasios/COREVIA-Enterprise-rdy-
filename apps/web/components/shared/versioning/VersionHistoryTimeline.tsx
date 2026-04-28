import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Clock, 
  User, 
  GitBranch, 
  CheckCircle2, 
  FileText, 
  Search, 
  Filter,
  ArrowUpDown,
  Eye,
  RefreshCw,
  GitCompare,
  AlertCircle,
  XCircle,
  Archive,
  Sparkles,
  Info,
  TrendingUp,
  Shield,
  AlertTriangle,
  Download,
  FileDown,
  Loader2
} from "lucide-react";
import type { ReportVersion } from "@shared/schema";
import { format } from "date-fns";
import { useTranslation } from 'react-i18next';
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface VersionHistoryTimelineProps {
  versions: ReportVersion[];
  reportId: string;
  currentVersionId?: string;
  onViewVersion: (versionId: string) => void;
  onCompareVersions: (versionId1: string, versionId2: string) => void;
  onRestoreVersion: (versionId: string) => void;
}

function openExportWindow(url: string): void {
  const exportWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (!exportWindow) {
    throw new Error('Unable to open export window');
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getVersionBusinessCaseScopeLabel(version: ReportVersion): string | null {
  const data = asRecord(version.versionData);
  const metadata = asRecord(version.versionMetadata);
  const explicitLabel = data?._businessCaseViewScopeLabel ?? metadata?._businessCaseViewScopeLabel;
  if (typeof explicitLabel === 'string' && explicitLabel.trim().length > 0) {
    return explicitLabel.trim();
  }

  const scopeKey = data?._businessCaseViewScope ?? metadata?._businessCaseViewScope;
  if (scopeKey === 'pilot') return 'Pilot business case';
  if (scopeKey === 'full') return 'Full commercial business case';

  const summary = typeof version.changesSummary === 'string' ? version.changesSummary.trim().toLowerCase() : '';
  if (summary.startsWith('pilot business case')) return 'Pilot business case';
  if (summary.startsWith('full commercial business case')) return 'Full commercial business case';
  return null;
}

function getVersionCreatorLabel(version: ReportVersion): string {
  if (typeof version.createdByName === "string" && version.createdByName.trim().length > 0) {
    return version.createdByName;
  }
  if (typeof version.createdBy === "string" && version.createdBy.trim().length > 0) {
    return version.createdBy;
  }
  return "System";
}

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    color: "bg-gray-500",
    icon: FileText,
    variant: "secondary" as const,
    pulseColor: "rgba(156, 163, 175, 0.5)"
  },
  under_review: {
    label: "Under Review",
    color: "bg-amber-500",
    icon: Clock,
    variant: "default" as const,
    pulseColor: "rgba(245, 158, 11, 0.5)"
  },
  approved: {
    label: "Approved",
    color: "bg-blue-500",
    icon: CheckCircle2,
    variant: "default" as const,
    pulseColor: "rgba(59, 130, 246, 0.5)"
  },
  published: {
    label: "Published",
    color: "bg-emerald-500",
    icon: Sparkles,
    variant: "default" as const,
    pulseColor: "rgba(16, 185, 129, 0.5)"
  },
  rejected: {
    label: "Rejected",
    color: "bg-rose-500",
    icon: XCircle,
    variant: "destructive" as const,
    pulseColor: "rgba(244, 63, 94, 0.5)"
  },
  archived: {
    label: "Archived",
    color: "bg-slate-500",
    icon: Archive,
    variant: "outline" as const,
    pulseColor: "rgba(100, 116, 139, 0.5)"
  },
  superseded: {
    label: "Superseded",
    color: "bg-purple-500",
    icon: GitBranch,
    variant: "outline" as const,
    pulseColor: "rgba(168, 85, 247, 0.5)"
  },
  manager_approval: {
    label: "Final Approval",
    color: "bg-indigo-500",
    icon: Shield,
    variant: "default" as const,
    pulseColor: "rgba(99, 102, 241, 0.5)"
  }
};

const RISK_CONFIG = {
  low: {
    label: "Low Risk",
    variant: "default" as const,
    icon: Shield,
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
  },
  medium: {
    label: "Medium Risk",
    variant: "default" as const,
    icon: AlertCircle,
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
  },
  high: {
    label: "High Risk",
    variant: "default" as const,
    icon: AlertTriangle,
    className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
  },
  critical: {
    label: "Critical Risk",
    variant: "destructive" as const,
    icon: XCircle,
    className: "bg-rose-600 text-white border-rose-700"
  }
};

interface ImpactAnalysisDialogProps {
  version: ReportVersion;
  reportId: string;
}

function ImpactAnalysisDialog({ version, reportId }: ImpactAnalysisDialogProps) {
  const { t } = useTranslation();
  const { data: impactData, isLoading } = useQuery({
    queryKey: ['/api/demand-reports', reportId, 'versions', version.id, 'impact'],
    enabled: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as { data?: any, isLoading: boolean };

  const analysis = impactData?.data;
  const riskLevel = analysis?.risk || 'low';
  const riskConfig = RISK_CONFIG[riskLevel as keyof typeof RISK_CONFIG] || RISK_CONFIG.low;
  const RiskIcon = riskConfig.icon;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid={`button-impact-${version.id}`}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          {t('versioning.historyTimeline.impact')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('versioning.historyTimeline.impactAnalysisTitle', { version: version.versionNumber })}
          </DialogTitle>
          <DialogDescription>
            {t('versioning.historyTimeline.impactAnalysisDesc')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              {t('versioning.historyTimeline.loadingImpact')}
            </div>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            {/* Risk Level */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">{t('versioning.historyTimeline.riskLevel')}</span>
              <Badge className={riskConfig.className}>
                <RiskIcon className="h-3 w-3 mr-1.5" />
                {t(`versioning.historyTimeline.risk_${riskLevel}`)}
              </Badge>
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">{t('versioning.historyTimeline.summary')}</h4>
              <p className="text-sm text-foreground bg-muted/50 p-3 rounded-md">
                {analysis.summary}
              </p>
            </div>

            {/* Impact */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">{t('versioning.historyTimeline.impactAssessment')}</h4>
              <p className="text-sm text-foreground bg-muted/50 p-3 rounded-md">
                {analysis.impact}
              </p>
            </div>

            {/* Changed Fields */}
            {analysis.changedFields && analysis.changedFields.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t('versioning.historyTimeline.changedFields')}</h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.changedFields.map((field: string) => (
                    <Badge key={field} variant="outline" className="text-xs">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Changes */}
            {analysis.detailedChanges && analysis.detailedChanges.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t('versioning.historyTimeline.detailedChanges')}</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {analysis.detailedChanges.map((change: any, idx: number) => (
                    <div key={idx} className="text-sm bg-muted/50 p-3 rounded-md">
                      <div className="font-medium text-foreground mb-1">{change.field}</div>
                      <div className="text-muted-foreground text-xs space-y-1">
                        {change.oldValue !== undefined && (
                          <div>
                            <span className="font-medium">{t('versioning.historyTimeline.before')}</span> {String(change.oldValue)}
                          </div>
                        )}
                        {change.newValue !== undefined && (
                          <div>
                            <span className="font-medium">{t('versioning.historyTimeline.after')}</span> {String(change.newValue)}
                          </div>
                        )}
                        {change.description && (
                          <div className="text-foreground mt-1">{change.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
              {analysis.fromCache && (
                <div className="flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {t('versioning.historyTimeline.cachedAnalysis')}
                </div>
              )}
              {analysis.comparedWith && (
                <div className="flex items-center gap-1">
                  <GitCompare className="h-3 w-3" />
                  {t('versioning.historyTimeline.comparedWith', { version: analysis.comparedWith })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t('versioning.historyTimeline.noImpactAnalysis')}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Extracted from .map() to comply with React Hooks rules
 
function VersionCard({ version, index: _index, reportId, currentVersionId, selectedForCompare, onViewVersion, onRestoreVersion, handleCompareClick }: {
  version: ReportVersion;
  index: number;
  reportId: string;
  currentVersionId?: string;
  selectedForCompare: string | null;
  onViewVersion: (id: string) => void;
  onRestoreVersion: (id: string) => void;
  handleCompareClick: (id: string) => void;
}) {
  const statusConfig = STATUS_CONFIG[version.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  const isCurrent = version.id === currentVersionId;
  const isSelected = version.id === selectedForCompare;
  const { t } = useTranslation();
  const businessCaseScopeLabel = getVersionBusinessCaseScopeLabel(version);

  // Hook is now in a proper React component (not a .map callback)
  const { data: impactData } = useQuery({
    queryKey: ['/api/demand-reports', reportId, 'versions', version.id, 'impact'],
    enabled: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as { data?: any };
  const _riskLevel = impactData?.data?.risk || 'low';

  return (
    <Card
      className={`hover-elevate transition-all duration-300 ${
        isCurrent ? 'border-primary shadow-md' : ''
      } ${isSelected ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
      data-testid={`version-card-${version.id}`}
    >
      <CardContent className="p-4 sm:p-6">
        {/* Header Section */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <h3 className="break-words font-bold text-xl">{version.versionNumber}</h3>
            <Badge variant={statusConfig.variant} className="text-sm whitespace-normal text-center leading-tight">
              {t(`versioning.historyTimeline.status_${version.status}`)}
            </Badge>
            {businessCaseScopeLabel && (
              <Badge variant="outline" className="max-w-full whitespace-normal text-center leading-tight">
                {businessCaseScopeLabel}
              </Badge>
            )}
            {isCurrent && (
              <Badge variant="outline" className="whitespace-normal border-primary bg-primary/10 text-primary">
                {t('versioning.historyTimeline.current')}
              </Badge>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="mb-4 break-words text-base leading-relaxed text-foreground">
          {version.changesSummary}
        </p>

        {/* Metadata Section */}
        <div className="space-y-2.5 mb-4 pb-4 border-b">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium">{getVersionCreatorLabel(version)}</span>
            {version.createdByRole && (
              <>
                <span className="text-muted-foreground">-</span>
                <span className="break-words text-muted-foreground">{version.createdByRole}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span className="break-words">{format(new Date(version.createdAt), "MMMM d, yyyy 'at' h:mm a")}</span>
          </div>

          {version.approvedBy && version.approvedByName && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span className="break-words">{t('versioning.historyTimeline.approvedBy', { name: version.approvedByName })}</span>
            </div>
          )}

          {version.branchId && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <GitBranch className="h-4 w-4 flex-shrink-0" />
              <span>{t('versioning.historyTimeline.branchVersion')}</span>
            </div>
          )}
        </div>

        {/* Edit Reason */}
        {version.editReason && (
          <div className="bg-muted/30 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm">
              <span className="font-semibold text-muted-foreground">{t('versioning.historyTimeline.editReason')} </span>
              <span className="text-foreground">{version.editReason}</span>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewVersion(version.id)}
            data-testid={`button-view-${version.id}`}
          >
            <Eye className="h-4 w-4 mr-2" />
            {t('versioning.historyTimeline.view')}
          </Button>

          <ImpactAnalysisDialog version={version} reportId={reportId} />

          <Button
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => handleCompareClick(version.id)}
            data-testid={`button-compare-${version.id}`}
          >
            <GitCompare className="h-4 w-4 mr-2" />
            {isSelected ? t('versioning.historyTimeline.selected') : t('versioning.historyTimeline.compare')}
          </Button>

          {!isCurrent && version.status === "published" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRestoreVersion(version.id)}
              data-testid={`button-restore-${version.id}`}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('versioning.historyTimeline.restore')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function VersionHistoryTimeline({
  versions,
  reportId,
  currentVersionId,
  onViewVersion,
  onCompareVersions,
  onRestoreVersion
}: VersionHistoryTimelineProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedForCompare, setSelectedForCompare] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Filter and sort versions
  const filteredVersions = versions
    .filter(v => {
      const scopeLabel = getVersionBusinessCaseScopeLabel(v)?.toLowerCase() ?? '';
      const matchesSearch = !searchQuery || 
        v.changesSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getVersionCreatorLabel(v).toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.versionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        scopeLabel.includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || v.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

  const handleCompareClick = (versionId: string) => {
    if (selectedForCompare) {
      onCompareVersions(selectedForCompare, versionId);
      setSelectedForCompare(null);
    } else {
      setSelectedForCompare(versionId);
    }
  };

  // PDF Export Handlers
  const handleExportFullHistory = async () => {
    setIsExporting(true);
    try {
      openExportWindow(`/api/demand-reports/${reportId}/versions/export/pdf`);

      toast({
        title: t('versioning.historyTimeline.exportSuccessful'),
        description: t('versioning.historyTimeline.historyDownloaded'),
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: t('versioning.historyTimeline.exportFailed'),
        description: error instanceof Error ? error.message : t('versioning.historyTimeline.failedToExport'),
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCurrentVersion = async () => {
    const latestVersion = versions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    if (!latestVersion) {
      toast({
        title: t('versioning.historyTimeline.noVersionAvailable'),
        description: t('versioning.historyTimeline.noVersionsToExport'),
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    try {
      openExportWindow(`/api/demand-reports/${reportId}/versions/${latestVersion.id}/export/pdf`);

      toast({
        title: t('versioning.historyTimeline.exportSuccessful'),
        description: t('versioning.historyTimeline.versionDownloaded', { version: latestVersion.versionNumber }),
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: t('versioning.historyTimeline.exportFailed'),
        description: error instanceof Error ? error.message : t('versioning.historyTimeline.failedToExport'),
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportComparison = async () => {
    const sortedVersions = [...versions].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (sortedVersions.length < 2) {
      toast({
        title: t('versioning.historyTimeline.insufficientVersions'),
        description: t('versioning.historyTimeline.need2Versions'),
        variant: "destructive"
      });
      return;
    }

    const v1 = sortedVersions[1];
    const v2 = sortedVersions[0];
    if (!v1 || !v2) return;

    setIsExporting(true);
    try {
      openExportWindow(`/api/demand-reports/${reportId}/versions/compare/${v1.id}/${v2.id}/pdf`);

      toast({
        title: t('versioning.historyTimeline.exportSuccessful'),
        description: t('versioning.historyTimeline.comparisonDownloaded', { v1: v1.versionNumber, v2: v2.versionNumber }),
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: t('versioning.historyTimeline.exportFailed'),
        description: error instanceof Error ? error.message : t('versioning.historyTimeline.failedToExport'),
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Get user initials for avatar
  const _getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" style={{ color: 'hsl(var(--accent-amber))' }} />
              {t('versioning.historyTimeline.title')}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('versioning.historyTimeline.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                  data-testid="input-search-versions"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] h-9" data-testid="select-status-filter">
                  <Filter className="h-3.5 w-3.5 mr-2" />
                  <SelectValue placeholder={t('versioning.historyTimeline.allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('versioning.historyTimeline.allStatuses')}</SelectItem>
                  <SelectItem value="draft">{t('versioning.historyTimeline.status_draft')}</SelectItem>
                  <SelectItem value="under_review">{t('versioning.historyTimeline.status_under_review')}</SelectItem>
                  <SelectItem value="approved">{t('versioning.historyTimeline.status_approved')}</SelectItem>
                  <SelectItem value="published">{t('versioning.historyTimeline.status_published')}</SelectItem>
                  <SelectItem value="rejected">{t('versioning.historyTimeline.status_rejected')}</SelectItem>
                  <SelectItem value="archived">{t('versioning.historyTimeline.status_archived')}</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                className="h-9"
                data-testid="button-toggle-sort"
              >
                <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                                {sortOrder === "desc" ? t('versioning.historyTimeline.newest') : t('versioning.historyTimeline.oldest')}
              </Button>

              {/* PDF Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9"
                    disabled={isExporting || versions.length === 0}
                    data-testid="button-export-pdf"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                        {t('versioning.historyTimeline.exporting')}
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5 mr-2" />
                        {t('versioning.historyTimeline.exportPdf')}
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t('versioning.historyTimeline.exportOptions')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    onClick={handleExportFullHistory}
                    disabled={isExporting}
                    data-testid="menu-export-full-history"
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    <div className="flex flex-col">
                      <span className="font-medium">{t('versioning.historyTimeline.fullVersionHistory')}</span>
                      <span className="text-xs text-muted-foreground">
                        {t('versioning.historyTimeline.allVersionsCount', { count: versions.length })}
                      </span>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuItem 
                    onClick={handleExportCurrentVersion}
                    disabled={isExporting || versions.length === 0}
                    data-testid="menu-export-current"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    <div className="flex flex-col">
                      <span className="font-medium">{t('versioning.historyTimeline.currentVersion')}</span>
                      <span className="text-xs text-muted-foreground">
                        {versions.length > 0 
                          ? t('versioning.historyTimeline.latestVersion', { version: versions.sort((a, b) => 
                              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                            )[0]?.versionNumber })
                          : t('versioning.historyTimeline.noVersions')}
                      </span>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem 
                    onClick={handleExportComparison}
                    disabled={isExporting || versions.length < 2}
                    data-testid="menu-export-comparison"
                  >
                    <GitCompare className="h-4 w-4 mr-2" />
                    <div className="flex flex-col">
                      <span className="font-medium">{t('versioning.historyTimeline.versionComparison')}</span>
                      <span className="text-xs text-muted-foreground">
                        {versions.length >= 2 
                          ? t('versioning.historyTimeline.latest2Versions')
                          : t('versioning.historyTimeline.need2PlusVersions')}
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Premium Vertical Command Center Timeline */}
      <div className="relative">
        {filteredVersions.length === 0 ? (
          <Card className="mission-module">
            <CardContent className="py-12 text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t('versioning.historyTimeline.noVersionsFound')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredVersions.map((version, index) => (
                <VersionCard
                  key={version.id}
                  version={version}
                  index={index}
                  reportId={reportId}
                  currentVersionId={currentVersionId}
                  selectedForCompare={selectedForCompare}
                  onViewVersion={onViewVersion}
                  onRestoreVersion={onRestoreVersion}
                  handleCompareClick={handleCompareClick}
                />
              ))}
          </div>
        )}
      </div>

      {/* Compare Selection Helper */}
      {selectedForCompare && (
        <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <GitCompare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="font-medium">
                  {t('versioning.historyTimeline.selectToCompare', { version: filteredVersions.find(v => v.id === selectedForCompare)?.versionNumber })}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedForCompare(null)}
                className="h-7"
                data-testid="button-cancel-compare"
              >
                {t('versioning.historyTimeline.cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -24;
          }
        }

        @keyframes status-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 ${STATUS_CONFIG.draft.pulseColor};
          }
          50% {
            box-shadow: 0 0 0 10px rgba(0, 0, 0, 0);
          }
        }

        .status-pulse {
          animation: status-pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
