import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clock, User, FileText, CheckCircle, AlertCircle, GitBranch, Send, ThumbsUp, ThumbsDown, Eye, Loader2, ChevronDown, ChevronUp, History } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Can } from "@/components/auth";
import VersionDetailView from "./VersionDetailView";
import type { ReportVersion } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface VersionPanelProps {
  demandReportId: string;
  versionType?: 'business_case' | 'requirements' | 'enterprise_architecture' | 'strategic_fit';
}

interface AuditEntry {
  id?: string;
  actionType: string;
  severity?: string;
  description: string;
  performedByName: string;
  timestamp: string;
  changeDetails?: Record<string, unknown>;
}

interface AuditResponse {
  data?: {
    auditTrail: AuditEntry[];
  };
}

interface VersionAuditTrailProps {
  version: ReportVersion;
  reportId: string;
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

function VersionAuditTrail({ version, reportId }: VersionAuditTrailProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: auditData, isLoading } = useQuery<AuditResponse>({
    queryKey: ['/api/demand-reports', reportId, 'versions', version.id, 'audit'],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/demand-reports/${reportId}/versions/${version.id}`);
      return await response.json();
    },
    enabled: isOpen, // Only fetch when expanded
  });

  const auditTrail = auditData?.data?.auditTrail || [];

  type BadgeVariant = 'default' | 'outline' | 'destructive' | 'secondary';

  interface ActionConfig {
    variant: BadgeVariant;
    label: string;
  }

  const getActionBadge = (action: string) => {
    const actionConfig: Record<string, ActionConfig> = {
      created: { variant: "default", label: "Created" },
      status_changed: { variant: "outline", label: "Status Changed" },
      approved: { variant: "default", label: "Approved" },
      rejected: { variant: "destructive", label: "Rejected" },
      published: { variant: "default", label: "Published" },
      archived: { variant: "secondary", label: "Archived" },
      restored: { variant: "outline", label: "Restored" },
    };
    const config = actionConfig[action] || { variant: "outline", label: action };
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      low: "text-blue-600",
      medium: "text-yellow-600",
      high: "text-orange-600",
      critical: "text-red-600",
    };
    return colors[severity] || "text-gray-600";
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="pt-3 border-t">
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start"
          data-testid={`button-toggle-audit-${version.id}`}
        >
          {isOpen ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
          <History className="h-4 w-4 mr-2" />
          <span>Audit Trail</span>
          {auditTrail.length > 0 && <Badge variant="outline" className="ml-2">{auditTrail.length}</Badge>}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading audit trail...
          </div>
        ) : auditTrail.length === 0 ? (
          <div className="text-sm text-muted-foreground p-2">
            No audit entries yet
          </div>
        ) : (
          <div className="space-y-2">
            {auditTrail.map((entry: AuditEntry, index: number) => (
              <div 
                key={entry.id || index} 
                className="text-xs p-2 rounded bg-muted/30 space-y-1"
                data-testid={`audit-entry-${index}`}
              >
                <div className="flex items-center justify-between">
                  {getActionBadge(entry.actionType)}
                  <span className={`text-xs font-medium ${getSeverityColor(entry.severity || 'low')}`}>
                    {entry.severity || 'low'}
                  </span>
                </div>
                <p className="text-sm">{entry.description}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {entry.performedByName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(entry.timestamp), 'MMM d, h:mm a')}
                  </span>
                </div>
                {entry.changeDetails && (
                  <div className="mt-1 p-2 bg-background rounded text-xs">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(entry.changeDetails, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface VersionActionProps {
  version: ReportVersion;
  reportId: string;
  onSuccess: () => void;
}

function VersionActions({ version, reportId, onSuccess }: VersionActionProps) {
  const { t } = useTranslation();
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvalComments, setApprovalComments] = useState("");
  const [showManagerApprovalDialog, setShowManagerApprovalDialog] = useState(false);
  const [managerEmail, setManagerEmail] = useState("");
  const [managerMessage, setManagerMessage] = useState("");
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const documentLabel = version.versionType === 'requirements'
    ? 'Requirements'
    : version.versionType === 'enterprise_architecture'
      ? 'Enterprise Architecture'
    : version.versionType === 'strategic_fit'
      ? 'Strategic Fit'
      : 'Business Case';

  const submitForReview = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/versions/${version.id}/submit-review`, {
        submittedBy: currentUser?.id,
        submittedByName: currentUser?.displayName,
        submittedByRole: currentUser?.role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/demand-reports', reportId, 'versions'],
        exact: false,
      });
      toast({ title: t('versioning.submittedForReview'), description: t('versioning.versionSubmittedForReview') });
      onSuccess();
    },
  });

  const approveVersion = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/demand-reports/${reportId}/versions/${version.id}/approve`, {
        approvedBy: currentUser?.id,
        approvedByName: currentUser?.displayName,
        approvedByRole: currentUser?.role,
        approvalComments,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/demand-reports', reportId, 'versions'],
        exact: false,
      });
      toast({ title: t('versioning.approved'), description: t('versioning.versionApprovedSuccessfully') });
      setShowApproveDialog(false);
      setApprovalComments("");
      onSuccess();
    },
  });

  const rejectVersion = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/versions/${version.id}/reject`, {
        rejectedBy: currentUser?.id,
        rejectedByName: currentUser?.displayName,
        rejectedByRole: currentUser?.role,
        rejectionReason,
      });
    },
    onSuccess: () => {
      // Invalidate versions list
      queryClient.invalidateQueries({
        queryKey: ['/api/demand-reports', reportId, 'versions'],
        exact: false,
      });
      
      // Invalidate content queries to show rolled-back content
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'business-case'] });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'requirements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'strategic-fit'] });
      
      toast({ 
        title: t('versioning.rejected'), 
        description: t('versioning.versionRejectedRolledBack') 
      });
      setShowRejectDialog(false);
      setRejectionReason("");
      onSuccess();
    },
  });

  const sendToManager = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/demand-reports/${reportId}/versions/${version.id}/send-to-manager`, {
        managerEmail,
        message: managerMessage,
        sentBy: currentUser?.id,
        sentByName: currentUser?.displayName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/demand-reports', reportId, 'versions'],
        exact: false,
      });
      toast({ 
        title: t('versioning.sentToManager'), 
        description: t('versioning.sentToManagerDesc', { documentLabel, email: managerEmail }) 
      });
      setShowManagerApprovalDialog(false);
      setManagerEmail("");
      setManagerMessage("");
      onSuccess();
    },
  });

  const isPending = submitForReview.isPending || approveVersion.isPending || rejectVersion.isPending || sendToManager.isPending;

  return (
    <>
      <div className="flex flex-wrap gap-2 pt-3 border-t">
        {version.status === 'draft' && (
          <Button
            size="sm"
            variant="default"
            onClick={() => submitForReview.mutate()}
            disabled={isPending}
            data-testid={`button-submit-review-${version.id}`}
          >
            {submitForReview.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
            Submit for Review
          </Button>
        )}

        {version.status === 'under_review' && (
          <>
            <Button
              size="sm"
              variant="default"
              onClick={() => setShowApproveDialog(true)}
              disabled={isPending}
              data-testid={`button-approve-${version.id}`}
            >
              <ThumbsUp className="h-3 w-3 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowRejectDialog(true)}
              disabled={isPending}
              data-testid={`button-reject-${version.id}`}
            >
              <ThumbsDown className="h-3 w-3 mr-1" />
              Reject
            </Button>
          </>
        )}

        {version.status === 'approved' && (
          <Button
            size="sm"
            variant="default"
            onClick={() => setShowManagerApprovalDialog(true)}
            disabled={isPending}
            data-testid={`button-send-manager-${version.id}`}
          >
            <Eye className="h-3 w-3 mr-1" />
            Send to Manager
          </Button>
        )}

        {version.status === 'manager_approval' && (
          <>
            <Can 
              permissions={['workflow:advance']}
              fallback={
                <Badge variant="outline" className="text-xs">
                  Awaiting Manager Approval
                </Badge>
              }
            >
              <Button
                size="sm"
                variant="default"
                onClick={() => setShowApproveDialog(true)}
                disabled={isPending}
                data-testid={`button-final-approve-${version.id}`}
              >
                <ThumbsUp className="h-3 w-3 mr-1" />
                Final Approval
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                disabled={isPending}
                data-testid={`button-final-reject-${version.id}`}
              >
                <ThumbsDown className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </Can>
          </>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Version {version.versionNumber}</DialogTitle>
            <DialogDescription>
              Add any comments about this approval (optional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={t('versioning.approvalComments')}
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
            rows={3}
            data-testid="textarea-approval-comments"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => approveVersion.mutate()} disabled={approveVersion.isPending}>
              {approveVersion.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Version {version.versionNumber}</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection (required).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={t('versioning.rejectionReason')}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
            data-testid="textarea-rejection-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectVersion.mutate()}
              disabled={!rejectionReason.trim() || rejectVersion.isPending}
            >
              {rejectVersion.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Manager Dialog */}
      <Dialog open={showManagerApprovalDialog} onOpenChange={setShowManagerApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send {documentLabel} to Manager</DialogTitle>
            <DialogDescription>
              Enter the manager's email to send the full {documentLabel.toLowerCase()} for final approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Manager Email</label>
              <input
                type="email"
                placeholder="manager@government.ae"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                data-testid="input-manager-email"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Message (Optional)</label>
              <Textarea
                placeholder={`Add a message to accompany the ${documentLabel.toLowerCase()}...`}
                value={managerMessage}
                onChange={(e) => setManagerMessage(e.target.value)}
                rows={3}
                data-testid="textarea-manager-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManagerApprovalDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendToManager.mutate()}
              disabled={!managerEmail.trim() || sendToManager.isPending}
            >
              {sendToManager.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send to Manager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface VersionsResponse {
  data: ReportVersion[];
}

export default function VersionPanel({ demandReportId, versionType }: VersionPanelProps) {
  const [selectedVersion, setSelectedVersion] = useState<ReportVersion | null>(null);
  const [showDetailView, setShowDetailView] = useState(false);

  const documentLabel = versionType === 'requirements'
    ? 'Requirements'
    : versionType === 'enterprise_architecture'
      ? 'Enterprise Architecture'
    : versionType === 'strategic_fit'
      ? 'Strategic Fit'
      : 'Business Case';
  
  const { data: versionsData, isLoading, isFetching, refetch } = useQuery<VersionsResponse>({
    queryKey: ['/api/demand-reports', demandReportId, 'versions'],
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    staleTime: 30000,
  });

  const versions = versionsData?.data || [];
  const filteredVersions = versionType 
    ? versions.filter((v: ReportVersion) => v.versionType === versionType)
    : versions;
  
  // Sort versions by creation date (newest first) to ensure latest version appears at top
  const sortedVersions = [...filteredVersions].sort((a: ReportVersion, b: ReportVersion) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  type StatusBadgeVariant = 'secondary' | 'outline' | 'default' | 'destructive';

  interface StatusConfig {
    variant: StatusBadgeVariant;
    label: string;
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, StatusConfig> = {
      draft: { variant: "secondary", label: "Draft" },
      under_review: { variant: "outline", label: "Under Review" },
      approved: { variant: "default", label: "Approved" },
      manager_approval: { variant: "default", label: "Final Approval" },
      published: { variant: "default", label: "Published" },
      archived: { variant: "secondary", label: "Archived" },
      rejected: { variant: "destructive", label: "Rejected" },
      superseded: { variant: "secondary", label: "Superseded" }
    };

    const config = statusConfig[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getVersionTypeColor = (versionNumber: string) => {
    if (versionNumber.includes('rollback')) return 'text-red-600';
    const [major, minor] = versionNumber.replace('v', '').split('.');
    if (parseInt(minor || '0') > 0) return 'text-blue-600';
    if (parseInt(major || '0') > 1) return 'text-purple-600';
    return 'text-green-600';
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading version history...
      </div>
    );
  }

  if (!sortedVersions.length) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No versions available yet. Generate the {documentLabel.toLowerCase()} to create a version.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Version History</h3>
          <Badge variant="outline" className="ml-auto">{sortedVersions.length} versions</Badge>
          {isFetching && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Syncing approvals
            </Badge>
          )}
        </div>

        {sortedVersions.map((version: ReportVersion) => (
          <Card key={version.id} className="hover-elevate">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-mono ${getVersionTypeColor(version.versionNumber)}`}>
                    {version.versionNumber}
                  </span>
                  {getStatusBadge(version.status)}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedVersion(version);
                      setShowDetailView(true);
                    }}
                    data-testid={`button-view-details-${version.id}`}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  {version.status === 'published' && (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  {version.status === 'rejected' && (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Changes Summary */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  Changes
                </div>
                <p className="text-sm">{version.changesSummary}</p>
              </div>

              {/* Edit Reason */}
              {version.editReason && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    Reason
                  </div>
                  <p className="text-sm text-muted-foreground">{version.editReason}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="flex flex-wrap gap-3 pt-2 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {getVersionCreatorLabel(version)}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(version.createdAt), 'MMM d, yyyy h:mm a')}
                </div>
              </div>

              {/* Approval Info */}
              {version.approvedBy && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span>Approved by {version.approvedByName}</span>
                    {version.approvedAt && (
                      <span className="text-muted-foreground">
                        on {format(new Date(version.approvedAt), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  {version.approvalComments && (
                    <p className="text-xs text-muted-foreground mt-1 ml-5">
                      {version.approvalComments}
                    </p>
                  )}
                </div>
              )}

              {/* Review Info */}
              {version.reviewedBy && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-xs">
                    <FileText className="h-3 w-3 text-blue-600" />
                    <span>Reviewed by {version.reviewedByName}</span>
                    {version.reviewedAt && (
                      <span className="text-muted-foreground">
                        on {format(new Date(version.reviewedAt), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  {version.reviewComments && (
                    <p className="text-xs text-muted-foreground mt-1 ml-5">
                      {version.reviewComments}
                    </p>
                  )}
                </div>
              )}

              {/* Rejection Info */}
              {version.rejectedBy && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-xs">
                    <AlertCircle className="h-3 w-3 text-red-600" />
                    <span>Rejected by {version.rejectedByName}</span>
                    {version.rejectedAt && (
                      <span className="text-muted-foreground">
                        on {format(new Date(version.rejectedAt), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  {version.rejectionReason && (
                    <p className="text-xs text-muted-foreground mt-1 ml-5">
                      {version.rejectionReason}
                    </p>
                  )}
                </div>
              )}

              {/* Audit Trail */}
              <VersionAuditTrail version={version} reportId={demandReportId} />

              {/* Version Actions */}
              <VersionActions 
                version={version} 
                reportId={demandReportId} 
                onSuccess={() => refetch()} 
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <VersionDetailView
        open={showDetailView}
        onClose={() => {
          setShowDetailView(false);
          setSelectedVersion(null);
        }}
        version={selectedVersion}
      />
    </ScrollArea>
  );
}
