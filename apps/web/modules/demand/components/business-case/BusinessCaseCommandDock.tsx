import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import { VersionCollaborationIndicator } from "@/components/shared/versioning";
import { DocumentExportDropdown } from "@/components/shared/document";
import {
  GitBranch,
  Clock,
  Edit,
  Save,
  X,
  Send,
  ThumbsUp,
  CheckCircle,
  Lock as LockIcon,
  Loader2,
  Calendar,
} from "lucide-react";
import type { BusinessCaseCommandDockProps } from "./types";
import { DOCUMENT_STATUS, BUTTON_CLASSES, isLockedVersion } from "./helpers";

export function BusinessCaseCommandDock({
  isEditMode,
  setIsEditMode,
  editedData,
  setEditedData,
  latestVersion,
  reportId,
  reportAccess,
  businessCaseData,
  validationErrors: _validationErrors,
  setValidationErrors,
  validateFields,
  setShowVersionDialog,
  setShowMeetingDialog,
  setShowApproveDialog,
  setShowSendToDirectorDialog,
  submitForReview,
  finalApprove,
  createVersionMutation,
  handleCreateNewVersion,
  handleEditToggle,
  getStatusBadge,
}: BusinessCaseCommandDockProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const handleSaveAndExit = () => {
    if (isLockedVersion(latestVersion)) {
      toast({
        title: t('demand.businessCase.commandDock.cannotSave'),
        description: t('demand.businessCase.commandDock.approvedLockedDescription'),
        variant: "destructive"
      });
      setIsEditMode(false);
      setEditedData(null);
      return;
    }

    if (!editedData) {
      toast({
        title: t('demand.businessCase.commandDock.error'),
        description: t('demand.businessCase.commandDock.waitForData'),
        variant: "destructive"
      });
      return;
    }
    
    const errors = validateFields(editedData);
    setValidationErrors(errors);
    
    if (Object.keys(errors).length === 0) {
      setShowVersionDialog(true);
    } else {
      toast({
        title: t('demand.businessCase.commandDock.validationError'),
        description: t('demand.businessCase.commandDock.fixErrors'),
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="bg-card/95 border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVersionDialog(true)}
              data-testid="button-toggle-versions"
              aria-label="Show version history"
            >
              <GitBranch className="mr-2 h-4 w-4" />
              {t('demand.businessCase.commandDock.showVersions')}
            </Button>
            
            {latestVersion && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t('demand.businessCase.commandDock.version', { number: latestVersion.versionNumber })}</span>
                {getStatusBadge(latestVersion.status)}
              </div>
            )}
            {isEditMode && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30">
                <Edit className="h-3 w-3 mr-1" />
                {t('demand.businessCase.commandDock.editingMode')}
              </Badge>
            )}
            {isLockedVersion(latestVersion) && (
              <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                <LockIcon className="h-3 w-3 mr-1" />
                {t('demand.businessCase.commandDock.approvedLocked')}
              </Badge>
            )}
            
            {latestVersion && (
              <VersionCollaborationIndicator
                versionId={latestVersion.id}
                reportId={reportId}
                compact={true}
              />
            )}
          </div>
          
          <div className="command-dock">
            {!isEditMode ? (
              <ViewModeActions
                latestVersion={latestVersion}
                reportId={reportId}
                reportAccess={reportAccess}
                businessCaseData={businessCaseData}
                setIsEditMode={setIsEditMode}
                setShowMeetingDialog={setShowMeetingDialog}
                setShowApproveDialog={setShowApproveDialog}
                setShowSendToDirectorDialog={setShowSendToDirectorDialog}
                submitForReview={submitForReview}
                finalApprove={finalApprove}
                createVersionMutation={createVersionMutation}
                handleCreateNewVersion={handleCreateNewVersion}
              />
            ) : (
              <EditModeActions
                handleSaveAndExit={handleSaveAndExit}
                handleEditToggle={handleEditToggle}
              />
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

interface ViewModeActionsProps {
  latestVersion: BusinessCaseCommandDockProps['latestVersion'];
  reportId: string;
  reportAccess: BusinessCaseCommandDockProps['reportAccess'];
  businessCaseData: BusinessCaseCommandDockProps['businessCaseData'];
  setIsEditMode: (value: boolean) => void;
  setShowMeetingDialog: (value: boolean) => void;
  setShowApproveDialog: (value: boolean) => void;
  setShowSendToDirectorDialog: (value: boolean) => void;
  submitForReview: BusinessCaseCommandDockProps['submitForReview'];
  finalApprove: BusinessCaseCommandDockProps['finalApprove'];
  createVersionMutation: BusinessCaseCommandDockProps['createVersionMutation'];
  handleCreateNewVersion: () => void;
}

function ViewModeActions({
  latestVersion,
  reportId,
  reportAccess,
  businessCaseData,
  setIsEditMode,
  setShowMeetingDialog,
  setShowApproveDialog,
  setShowSendToDirectorDialog,
  submitForReview,
  finalApprove,
  createVersionMutation,
  handleCreateNewVersion,
}: ViewModeActionsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const status = latestVersion?.status;
  
  const handleSubmitForReview = () => {
    submitForReview.mutate({
      onError: (error: Error) => {
        toast({
          title: t('demand.businessCase.commandDock.submissionFailed'),
          description: error.message || t('demand.businessCase.commandDock.failedSubmitReview'),
          variant: "destructive"
        });
      }
    });
  };
  
  const handleFinalApprove = () => {
    finalApprove.mutate({
      onError: (error: Error) => {
        toast({
          title: t('demand.businessCase.commandDock.approvalFailed'),
          description: error.message || t('demand.businessCase.commandDock.failedFinalApproval'),
          variant: "destructive"
        });
      }
    });
  };
  
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {status === DOCUMENT_STATUS.DRAFT && (
        <Button
          onClick={handleSubmitForReview}
          variant="default"
          size="sm"
          disabled={submitForReview.isPending}
          className={BUTTON_CLASSES.primary}
          data-testid="button-submit-review"
          aria-label="Submit business case for review"
        >
          {submitForReview.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-3.5 w-3.5" />
          )}
          Submit for Review
        </Button>
      )}
      
      {status === DOCUMENT_STATUS.UNDER_REVIEW && reportAccess.canApprove && (
        <Button
          onClick={() => setShowApproveDialog(true)}
          variant="default"
          size="sm"
          className={BUTTON_CLASSES.success}
          data-testid="button-approve"
          aria-label="Give initial approval"
        >
          <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
          {t('demand.businessCase.commandDock.initialApproval')}
        </Button>
      )}
      
      {status === DOCUMENT_STATUS.APPROVED && reportAccess.canApprove && (
        <Button
          onClick={() => setShowSendToDirectorDialog(true)}
          variant="default"
          size="sm"
          className={BUTTON_CLASSES.purple}
          data-testid="button-submit-director"
          aria-label="Submit for director approval"
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {t('demand.businessCase.commandDock.submitForDirector')}
        </Button>
      )}
      
      {status === DOCUMENT_STATUS.MANAGER_APPROVAL && reportAccess.canFinalApprove && (
        <Button
          onClick={handleFinalApprove}
          variant="default"
          size="sm"
          disabled={finalApprove.isPending}
          className={BUTTON_CLASSES.purple}
          data-testid="button-final-approve"
          aria-label="Give final approval"
        >
          {finalApprove.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
          )}
          Final Approval
        </Button>
      )}
      
      {isLockedVersion(latestVersion) ? (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-green-500/10 border border-green-500/20">
            <LockIcon className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">{t('demand.businessCase.commandDock.viewOnly')}</span>
          </div>
          <Button
            onClick={handleCreateNewVersion}
            variant="outline"
            size="sm"
            disabled={createVersionMutation.isPending}
            className="h-8 px-3 text-xs"
            data-testid="button-create-new-version"
            aria-label="Create a new version"
          >
            {createVersionMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <GitBranch className="mr-1.5 h-3.5 w-3.5" />
            )}
            New Version
          </Button>
        </div>
      ) : businessCaseData?.data && (
        <div className="flex items-center gap-1.5">
          <Button
            onClick={() => setIsEditMode(true)}
            variant="default"
            size="sm"
            className={BUTTON_CLASSES.primary}
            data-testid="button-edit-business-case"
            aria-label="Edit business case"
          >
            <Edit className="mr-1.5 h-3.5 w-3.5" />
            {t('demand.businessCase.commandDock.edit')}
          </Button>
          <Button
            onClick={() => setShowMeetingDialog(true)}
            variant="default"
            size="sm"
            className={BUTTON_CLASSES.warning}
            data-testid="button-schedule-meeting"
            aria-label="Schedule a meeting"
          >
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            {t('demand.businessCase.commandDock.scheduleMeeting')}
          </Button>
          <DocumentExportDropdown 
            reportId={reportId} 
            versionId={latestVersion?.id}
            documentType="business_case"
          />
        </div>
      )}
    </div>
  );
}

interface EditModeActionsProps {
  handleSaveAndExit: () => void;
  handleEditToggle: () => void;
}

function EditModeActions({
  handleSaveAndExit,
  handleEditToggle,
}: EditModeActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 animate-fade-in">
      <Button
        onClick={handleSaveAndExit}
        variant="default"
        className={BUTTON_CLASSES.success}
        data-testid="button-save-exit"
        aria-label="Save changes and exit edit mode"
      >
        <Save className="mr-2 h-4 w-4" />
        {t('demand.businessCase.commandDock.saveAndExit')}
      </Button>
      <Button
        onClick={handleEditToggle}
        variant="outline"
        data-testid="button-cancel-edit"
        aria-label="Cancel editing and discard changes"
      >
        <X className="mr-2 h-4 w-4" />
        {t('demand.businessCase.commandDock.cancel')}
      </Button>
    </div>
  );
}
