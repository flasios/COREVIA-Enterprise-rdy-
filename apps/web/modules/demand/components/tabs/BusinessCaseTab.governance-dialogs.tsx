import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { HexagonLogoFrame } from '@/components/shared/misc';
import { AlertTriangle, Check, CheckCircle2, Loader2, Shield } from 'lucide-react';
import type { CollaborationEditor } from '../business-case';
import { normalizePercentValue } from './BusinessCaseTab.helpers';

interface BrainStatusView {
  badgeClass: string;
  label: string;
  nextGate: string;
}

interface ActionItemView {
  key: string;
  label: string;
  description: string;
}

interface ActionExecutionView {
  id?: string;
  actionType?: string;
  status?: string;
}

interface BrainDecisionView {
  status?: string;
  approval?: Record<string, unknown>;
  actionExecutions?: ActionExecutionView[];
}

interface EditConflictView {
  versionId: string;
  currentEditor: CollaborationEditor;
}

interface BusinessCaseGovernanceDialogsProps {
  showEditConflictDialog: boolean;
  onEditConflictOpenChange: (open: boolean) => void;
  editConflict: EditConflictView | null;
  onTakeOverEditing: () => void;
  showApproveDialog: boolean;
  onApproveDialogOpenChange: (open: boolean) => void;
  approvalComments: string;
  onApprovalCommentsChange: (value: string) => void;
  onApprove: () => void;
  isApproving: boolean;
  showSendToDirectorDialog: boolean;
  onSendToDirectorDialogOpenChange: (open: boolean) => void;
  managerEmail: string;
  onManagerEmailChange: (value: string) => void;
  managerMessage: string;
  onManagerMessageChange: (value: string) => void;
  onSendToDirector: () => void;
  isSendingToDirector: boolean;
  showBrainGovernance: boolean;
  onBrainGovernanceOpenChange: (open: boolean) => void;
  brainDecisionId: string | null | undefined;
  decisionSource: string;
  brainStatus: BrainStatusView;
  classification: string;
  classificationConfidence: number | null | undefined;
  showBrainApproval: boolean;
  onBrainApprovalOpenChange: (open: boolean) => void;
  brainApprovalAction: 'approve' | 'revise' | 'reject';
  onBrainApprovalActionChange: (value: 'approve' | 'revise' | 'reject') => void;
  actionItems: ActionItemView[];
  selectedActionKeys: string[];
  onSelectedActionKeysChange: (value: string[]) => void;
  brainApprovalNotes: string;
  onBrainApprovalNotesChange: (value: string) => void;
  onSubmitBrainApproval: () => void;
  isSubmittingBrainApproval: boolean;
  brainDecision: BrainDecisionView | null | undefined;
  onExecuteApprovedActions: () => void;
  isExecutingApprovedActions: boolean;
  lastApprovalId: string | null;
}

export function BusinessCaseGovernanceDialogs({
  showEditConflictDialog,
  onEditConflictOpenChange,
  editConflict,
  onTakeOverEditing,
  showApproveDialog,
  onApproveDialogOpenChange,
  approvalComments,
  onApprovalCommentsChange,
  onApprove,
  isApproving,
  showSendToDirectorDialog,
  onSendToDirectorDialogOpenChange,
  managerEmail,
  onManagerEmailChange,
  managerMessage,
  onManagerMessageChange,
  onSendToDirector,
  isSendingToDirector,
  showBrainGovernance,
  onBrainGovernanceOpenChange,
  brainDecisionId,
  decisionSource,
  brainStatus,
  classification,
  classificationConfidence,
  showBrainApproval,
  onBrainApprovalOpenChange,
  brainApprovalAction,
  onBrainApprovalActionChange,
  actionItems,
  selectedActionKeys,
  onSelectedActionKeysChange,
  brainApprovalNotes,
  onBrainApprovalNotesChange,
  onSubmitBrainApproval,
  isSubmittingBrainApproval,
  brainDecision,
  onExecuteApprovedActions,
  isExecutingApprovedActions,
  lastApprovalId,
}: Readonly<BusinessCaseGovernanceDialogsProps>) {
  const { t } = useTranslation();
  const classificationConfidencePercent = normalizePercentValue(classificationConfidence);
  const executionApprovalId = brainDecision?.approval?.approvalId;
  const canExecuteApprovedActions = Boolean(executionApprovalId || lastApprovalId);

  return (
    <>
      <Dialog open={showEditConflictDialog} onOpenChange={onEditConflictOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              {t('demand.tabs.businessCase.anotherUserEditing')}
            </DialogTitle>
            <DialogDescription>
              {editConflict?.currentEditor?.displayName} {t('demand.tabs.businessCase.currentlyEditingVersion')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-orange-300 bg-orange-500/5 p-4 dark:border-orange-700">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Avatar className="h-10 w-10 border-2 border-orange-500">
                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 font-semibold text-white">
                      {editConflict?.currentEditor?.displayName?.split(' ').map((name: string) => name[0]).join('').toUpperCase().substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{editConflict?.currentEditor?.displayName}</div>
                  {editConflict?.currentEditor?.role && (
                    <div className="text-sm capitalize text-muted-foreground">{editConflict.currentEditor.role}</div>
                  )}
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t('demand.tabs.businessCase.currentlyEditingVersion')}
                  </div>
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {t('demand.tabs.businessCase.preventConflictsText')}
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>{t('demand.tabs.businessCase.waitForFinish')}</li>
                <li>{t('demand.tabs.businessCase.takeOverEditing')}</li>
                <li>{t('demand.tabs.businessCase.viewReadOnly')}</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onEditConflictOpenChange(false)}
              data-testid="button-cancel-edit-takeover"
            >
              {t('demand.tabs.businessCase.cancel')}
            </Button>
            <Button
              variant="default"
              onClick={onTakeOverEditing}
              data-testid="button-confirm-edit-takeover"
            >
              {t('demand.tabs.businessCase.takeOverEditingBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showApproveDialog} onOpenChange={onApproveDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('demand.tabs.businessCase.initialApproval')}</DialogTitle>
            <DialogDescription>
              {t('demand.tabs.businessCase.approveVersionDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="approval-comments">{t('demand.tabs.businessCase.approvalCommentsOptional')}</Label>
              <Textarea
                id="approval-comments"
                value={approvalComments}
                onChange={(event) => onApprovalCommentsChange(event.target.value)}
                placeholder={t('demand.tabs.businessCase.addCommentsPlaceholder')}
                className="mt-1"
                data-testid="textarea-approval-comments"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onApproveDialogOpenChange(false)}>
              {t('demand.tabs.businessCase.cancel')}
            </Button>
            <Button onClick={onApprove} disabled={isApproving} data-testid="button-confirm-approve">
              {isApproving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('demand.tabs.businessCase.approving')}
                </>
              ) : (
                t('demand.tabs.businessCase.approve')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSendToDirectorDialog} onOpenChange={onSendToDirectorDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('demand.tabs.businessCase.submitForDirectorApproval')}</DialogTitle>
            <DialogDescription>
              {t('demand.tabs.businessCase.sendToDirectorDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="director-email">{t('demand.tabs.businessCase.directorEmail')} *</Label>
              <Input
                id="director-email"
                type="email"
                value={managerEmail}
                onChange={(event) => onManagerEmailChange(event.target.value)}
                placeholder="director@example.com"
                className="mt-1"
                data-testid="input-director-email"
              />
            </div>
            <div>
              <Label htmlFor="director-message">{t('demand.tabs.businessCase.messageToDirectorOptional')}</Label>
              <Textarea
                id="director-message"
                value={managerMessage}
                onChange={(event) => onManagerMessageChange(event.target.value)}
                placeholder={t('demand.tabs.businessCase.addMessagePlaceholder')}
                className="mt-1"
                data-testid="textarea-director-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onSendToDirectorDialogOpenChange(false)}>
              {t('demand.tabs.businessCase.cancel')}
            </Button>
            <Button
              onClick={onSendToDirector}
              disabled={!managerEmail || isSendingToDirector}
              data-testid="button-confirm-send-director"
            >
              {isSendingToDirector ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('demand.tabs.businessCase.sending')}
                </>
              ) : (
                t('demand.tabs.businessCase.submitForDirectorApproval')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={showBrainGovernance} onOpenChange={onBrainGovernanceOpenChange}>
        <SheetContent side="right" className="z-[9999] w-[420px] overflow-y-auto sm:w-[520px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <HexagonLogoFrame px={20} />
              {t('demand.tabs.businessCase.coreviaBrainGovernance')}
            </SheetTitle>
            <SheetDescription>
              {t('demand.tabs.businessCase.decisionSpineGovernanceDescription')}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('demand.tabs.businessCase.decisionSpine')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('demand.tabs.businessCase.decisionId')}</span>
                  <span className="font-mono">{brainDecisionId || t('demand.tabs.businessCase.notAvailable')}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('demand.tabs.businessCase.pipelineSource')}</span>
                  <span>{decisionSource}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('demand.tabs.businessCase.status')}</span>
                  <Badge className={brainStatus.badgeClass}>{brainStatus.label}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('demand.tabs.businessCase.classificationLabel')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('demand.tabs.businessCase.classificationLabel')}</span>
                  <span className="capitalize">{classification}</span>
                </div>
                {classificationConfidencePercent !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('demand.tabs.businessCase.confidence')}</span>
                    <span>{classificationConfidencePercent}%</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('demand.tabs.businessCase.redactionGateway')}</span>
                  <Badge variant="outline" className="text-xs">{t('demand.tabs.businessCase.enabled')}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('demand.tabs.businessCase.nextGate')}</span>
                  <span>{brainStatus.nextGate}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('demand.tabs.businessCase.attestations')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('demand.tabs.businessCase.runAttestation')}</span>
                  <Badge variant="outline" className="text-xs">{t('demand.tabs.businessCase.recorded')}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('demand.tabs.businessCase.redactionReceipt')}</span>
                  <Badge variant="outline" className="text-xs">{t('demand.tabs.businessCase.recorded')}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('demand.tabs.businessCase.attestationsDescription')}
                </p>
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showBrainApproval} onOpenChange={onBrainApprovalOpenChange}>
        <SheetContent side="right" className="w-[420px] overflow-y-auto sm:w-[520px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t('demand.tabs.businessCase.layer7ApprovalGate')}
            </SheetTitle>
            <SheetDescription>
              {t('demand.tabs.businessCase.recordGovernanceApprovals')}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('demand.tabs.businessCase.decisionContext')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('demand.tabs.businessCase.decisionId')}</span>
                  <span className="font-mono">{brainDecisionId || t('demand.tabs.businessCase.notAvailable')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('demand.tabs.businessCase.status')}</span>
                  <Badge className={brainStatus.badgeClass}>{brainStatus.label}</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Label className="text-sm">{t('demand.tabs.businessCase.approvalAction')}</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={brainApprovalAction === 'approve' ? 'default' : 'outline'}
                  onClick={() => onBrainApprovalActionChange('approve')}
                  className="justify-center"
                >
                  {t('demand.tabs.businessCase.approve')}
                </Button>
                <Button
                  type="button"
                  variant={brainApprovalAction === 'revise' ? 'default' : 'outline'}
                  onClick={() => onBrainApprovalActionChange('revise')}
                  className="justify-center"
                >
                  {t('demand.tabs.businessCase.revise')}
                </Button>
                <Button
                  type="button"
                  variant={brainApprovalAction === 'reject' ? 'destructive' : 'outline'}
                  onClick={() => onBrainApprovalActionChange('reject')}
                  className="justify-center"
                >
                  {t('demand.tabs.businessCase.reject')}
                </Button>
              </div>
            </div>

            {brainApprovalAction === 'approve' && actionItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t('demand.tabs.businessCase.approvedActions')}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectedActionKeysChange(actionItems.map((item) => item.key))}
                  >
                    {t('demand.tabs.businessCase.selectAll')}
                  </Button>
                </div>
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  {actionItems.map((item) => (
                    <div key={item.key} className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedActionKeys.includes(item.key)}
                        onCheckedChange={(checked) => {
                          onSelectedActionKeysChange(
                            checked
                              ? [...selectedActionKeys, item.key]
                              : selectedActionKeys.filter((key) => key !== item.key)
                          );
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.label}</p>
                        {item.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="brain-approval-notes">{t('demand.tabs.businessCase.approvalNotes')}</Label>
              <Textarea
                id="brain-approval-notes"
                value={brainApprovalNotes}
                onChange={(event) => onBrainApprovalNotesChange(event.target.value)}
                placeholder={t('demand.tabs.businessCase.captureDecisionRationale')}
                className="min-h-[120px]"
              />
            </div>

            <Button
              onClick={onSubmitBrainApproval}
              disabled={isSubmittingBrainApproval || !brainDecisionId}
              className="w-full gap-2"
            >
              {isSubmittingBrainApproval ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('demand.tabs.businessCase.recordingDecision')}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {t('demand.tabs.businessCase.submitGovernanceAction')}
                </>
              )}
            </Button>

            {brainDecision?.status === 'action_execution' && (
              <Button
                variant="outline"
                onClick={onExecuteApprovedActions}
                disabled={isExecutingApprovedActions || !canExecuteApprovedActions}
                className="w-full gap-2"
              >
                {isExecutingApprovedActions ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('demand.tabs.businessCase.executingActions')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    {t('demand.tabs.businessCase.executeApprovedActions')}
                  </>
                )}
              </Button>
            )}

            {(brainDecision?.actionExecutions?.length ?? 0) > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t('demand.tabs.businessCase.executionReceipts')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {brainDecision?.actionExecutions?.map((execution, index) => (
                    <div key={execution.id || index} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{execution.actionType || `Action ${index + 1}`}</span>
                      <Badge variant="outline" className="text-xs">
                        {String(execution.status || 'completed').toLowerCase()}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}