import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  Clock,
  User,
  FileText,
  DollarSign,
  Calendar,
  Users,
  Target,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  GitBranch,
  Shield
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from 'react-i18next';
import { VersionAuditTrail } from "./VersionAuditTrail";
import { VersionSignatureStatus } from "@/components/shared/versioning";
import { useAuth } from "@/contexts/AuthContext";
import type { ReportVersion } from "@shared/schema";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

interface VersionDetailViewProps {
  open: boolean;
  onClose: () => void;
  version: ReportVersion | null;
}

export default function VersionDetailView({
  open,
  onClose,
  version
}: VersionDetailViewProps) {
  const { currentUser } = useAuth();
  const { t } = useTranslation();

  if (!version) return null;

  const versionData =
    version.versionData && typeof version.versionData === "object"
      ? (version.versionData as Record<string, any>) // eslint-disable-line @typescript-eslint/no-explicit-any
      : {};
  const versionMetadata =
    version.versionMetadata && typeof version.versionMetadata === "object"
      ? (version.versionMetadata as Record<string, any>) // eslint-disable-line @typescript-eslint/no-explicit-any
      : {};

  const creatorLabel = typeof version.createdByName === "string" && version.createdByName.trim().length > 0
    ? version.createdByName
    : (version.createdBy || "System");

  const computedFinancialModel = asObject(versionData?.computedFinancialModel);
  const computedFinancialInputs = asObject(computedFinancialModel?.inputs);
  const computedFinancialMetrics = asObject(computedFinancialModel?.metrics);

  const financialBudget =
    versionData?.estimatedBudget
    ?? versionData?.totalCostEstimate
    ?? versionData?.lifecycleCostEstimate
    ?? computedFinancialInputs?.totalInvestment
    ?? computedFinancialMetrics?.totalCosts;

  const timelineObj = asObject(versionData?.timeline);
  const implementationTimelineObj = asObject(versionData?.implementationTimeline);
  const financialTimeline =
    versionData?.estimatedTimeline
    ?? versionData?.timeline
    ?? timelineObj?.estimatedDuration
    ?? versionData?.implementationTimeline
    ?? implementationTimelineObj?.estimatedDuration;

  const financialConstraints =
    versionData?.constraints
    ?? versionData?.riskConstraints
    ?? versionData?.assumptions;

  const hasFinancialDetails = financialBudget !== undefined || financialTimeline !== undefined || financialConstraints !== undefined;

  const getStatusIcon = () => {
    switch (version.status) {
      case "published": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "rejected": return <XCircle className="h-4 w-4 text-rose-500" />;
      case "under_review": return <Clock className="h-4 w-4 text-amber-500" />;
      case "draft": return <FileText className="h-4 w-4 text-gray-500" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    switch (version.status) {
      case "published": return "default";
      case "rejected": return "destructive";
      case "under_review": return "default";
      default: return "secondary";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            {t('versioning.detailView.title', { version: version.versionNumber })}
          </DialogTitle>
          <DialogDescription>
            {t('versioning.detailView.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Version Metadata */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('versioning.detailView.versionInformation')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.version')}</label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{version.versionNumber}</Badge>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.status')}</label>
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <Badge variant={getStatusVariant()}>{version.status}</Badge>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.created')}</label>
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {(() => {
                    try {
                      const d = new Date(version.createdAt);
                      return isNaN(d.getTime()) ? 'N/A' : format(d, "MMM d, yyyy");
                    } catch {
                      return 'N/A';
                    }
                  })()}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.type')}</label>
                <Badge variant="outline" className="h-5">
                  {version.versionType}
                </Badge>
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.createdBy')}</label>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span>{creatorLabel}</span>
                  {version.createdByRole && (
                    <Badge variant="outline" className="h-4 text-[10px]">{version.createdByRole}</Badge>
                  )}
                </div>
              </div>

              {version.createdByDepartment && (
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.department')}</label>
                  <div className="text-sm">{version.createdByDepartment}</div>
                </div>
              )}

              {version.approvedBy && (
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.approvedBy')}</label>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span>{version.approvedByName}</span>
                    {version.approvedAt && (
                      <span className="text-muted-foreground">
                        on {(() => {
                          try {
                            const d = new Date(version.approvedAt);
                            return isNaN(d.getTime()) ? 'N/A' : format(d, "MMM d, yyyy");
                          } catch {
                            return 'N/A';
                          }
                        })()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {version.reviewedBy && (
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.reviewedBy')}</label>
                  <div className="flex items-center gap-2 text-sm">
                    <Eye className="h-3 w-3 text-blue-500" />
                    <span>{version.reviewedByName}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Change Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                {t('versioning.detailView.changeSummary')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm bg-muted/50 p-3 rounded-md">{version.changesSummary}</p>
              {version.editReason && (
                <div className="mt-3">
                  <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.editReason')}</label>
                  <p className="text-sm bg-muted/50 p-3 rounded-md mt-1">{version.editReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Content Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">{t('versioning.detailView.tabOverview')}</TabsTrigger>
              <TabsTrigger value="financial">{t('versioning.detailView.tabFinancial')}</TabsTrigger>
              <TabsTrigger value="stakeholders">{t('versioning.detailView.tabStakeholders')}</TabsTrigger>
              <TabsTrigger value="audit">{t('versioning.detailView.tabAuditTrail')}</TabsTrigger>
              <TabsTrigger value="signature">{t('versioning.detailView.tabSignature')}</TabsTrigger>
              <TabsTrigger value="metadata">{t('versioning.detailView.tabMetadata')}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-3.5 w-3.5 text-muted-foreground" />
                      {t('versioning.detailView.businessObjective')}
                    </label>
                    <div className="text-sm bg-muted/50 p-3 rounded-md">
                      {versionData?.businessObjective || t('versioning.detailView.notSpecified')}
                    </div>
                  </div>

                  {versionData?.expectedOutcomes && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('versioning.detailView.expectedOutcomes')}</label>
                      <div className="text-sm bg-muted/50 p-3 rounded-md">
                        {typeof versionData.expectedOutcomes === 'string'
                          ? versionData.expectedOutcomes
                          : Array.isArray(versionData.expectedOutcomes)
                            ? (versionData.expectedOutcomes as unknown[]).map((item: unknown, idx: number) => (
                                <div key={idx} className="mb-1">
                                  • {typeof item === 'string' ? item : typeof item === 'object' && item !== null
                                    ? ((item as Record<string, unknown>).outcome || (item as Record<string, unknown>).description || (item as Record<string, unknown>).name || JSON.stringify(item)) as string
                                    : String(item)}
                                </div>
                              ))
                            : JSON.stringify(versionData.expectedOutcomes)}
                      </div>
                    </div>
                  )}

                  {versionData?.successCriteria && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('versioning.detailView.successCriteria')}</label>
                      <div className="text-sm bg-muted/50 p-3 rounded-md space-y-2">
                        {typeof versionData.successCriteria === 'string'
                          ? versionData.successCriteria
                          : Array.isArray(versionData.successCriteria)
                            ? (versionData.successCriteria as unknown[]).map((item: unknown, idx: number) => {
                                if (typeof item === 'string') return <div key={idx} className="mb-1">• {item}</div>;
                                if (typeof item === 'object' && item !== null) {
                                  const obj = item as Record<string, unknown>;
                                  const criterion = (obj.criterion || obj.name || obj.title || '') as string;
                                  const target = (obj.target || obj.metric || obj.measure || '') as string;
                                  return (
                                    <div key={idx} className="flex items-start gap-2 bg-background/50 p-2 rounded">
                                      <Target className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                                      <div>
                                        <div className="font-medium text-sm">{criterion || 'Criterion'}</div>
                                        {target && <div className="text-xs text-muted-foreground">Target: {target}</div>}
                                      </div>
                                    </div>
                                  );
                                }
                                return <div key={idx}>• {String(item)}</div>;
                              })
                            : JSON.stringify(versionData.successCriteria)}
                      </div>
                    </div>
                  )}

                  {versionData?.urgency && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('versioning.detailView.urgency')}</label>
                      <Badge variant="outline">{versionData.urgency}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {financialBudget !== undefined && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                        {t('versioning.detailView.estimatedBudget')}
                      </label>
                      <div className="text-lg font-semibold bg-muted/50 p-3 rounded-md">
                        {typeof financialBudget === 'string' || typeof financialBudget === 'number'
                          ? String(financialBudget)
                          : JSON.stringify(financialBudget)}
                      </div>
                    </div>
                  )}

                  {financialTimeline !== undefined && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {t('versioning.detailView.timeline')}
                      </label>
                      <div className="text-sm bg-muted/50 p-3 rounded-md">
                        {typeof financialTimeline === 'string'
                          ? financialTimeline
                          : JSON.stringify(financialTimeline)}
                      </div>
                    </div>
                  )}

                  {financialConstraints !== undefined && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                        {t('versioning.detailView.constraints')}
                      </label>
                      <div className="text-sm bg-muted/50 p-3 rounded-md">
                        {typeof financialConstraints === 'string'
                          ? financialConstraints
                          : Array.isArray(financialConstraints)
                            ? (financialConstraints as unknown[]).map((c: unknown, i: number) => <div key={i}>• {String(c)}</div>)
                            : JSON.stringify(financialConstraints)}
                      </div>
                    </div>
                  )}

                  {!hasFinancialDetails && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t('versioning.detailView.notSpecified')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stakeholders" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  {versionData?.stakeholders ? (
                    <div className="space-y-3">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {t('versioning.detailView.stakeholderList')}
                      </label>
                      <div className="text-sm bg-muted/50 p-3 rounded-md whitespace-pre-wrap">
                        {typeof versionData.stakeholders === 'string'
                          ? versionData.stakeholders
                          : JSON.stringify(versionData.stakeholders, null, 2)}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t('versioning.detailView.noStakeholders')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <VersionAuditTrail
                reportId={version.reportId}
                versionId={version.id}
                versionNumber={version.versionNumber}
              />
            </TabsContent>

            <TabsContent value="signature" className="space-y-4">
              <VersionSignatureStatus
                reportId={version.reportId}
                versionId={version.id}
                versionNumber={version.versionNumber}
                versionStatus={version.status}
                userRole={currentUser?.role || 'analyst'}
              />
            </TabsContent>

            <TabsContent value="metadata" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.contentHash')}</label>
                      <div className="text-xs font-mono bg-muted/50 p-2 rounded break-all">
                        {typeof version.contentHash === 'string' && version.contentHash.length > 0
                          ? `${version.contentHash.substring(0, 32)}...`
                          : 'N/A'}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.validationStatus')}</label>
                      <Badge variant={String(version.validationStatus) === "valid" ? "default" : "destructive"}>
                        {String(version.validationStatus || "pending")}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.complianceLevel')}</label>
                      <Badge variant="outline">
                        <Shield className="h-3 w-3 mr-1" />
                        {versionMetadata.complianceLevel || "standard"}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.lastModified')}</label>
                      <div className="text-xs text-muted-foreground">
                        {(() => {
                          try {
                            return format(new Date(version.updatedAt || version.createdAt), "PPp");
                          } catch {
                            return 'N/A';
                          }
                        })()}
                      </div>
                    </div>
                  </div>

                  {Object.keys(versionMetadata).length > 0 ? (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">{t('versioning.detailView.additionalMetadata')}</label>
                      <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto">
                        {JSON.stringify(versionMetadata, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="shrink-0 flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            {t('versioning.detailView.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
