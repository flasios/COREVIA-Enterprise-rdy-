import HexagonLogoFrame from '@/components/shared/misc/HexagonLogoFrame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Check, CheckCircle2, Loader2, Shield } from 'lucide-react';

interface Translate {
  (key: string): string;
}

interface BrainStatus {
  label: string;
  badgeClass: string;
  nextGate: string;
}

interface ActionItem {
  key: string;
  label: string;
  description: string;
}

interface ExecutionReceipt {
  id?: string | number;
  actionType?: string;
  action?: string;
  status?: string;
}

function normalizePercentValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  const scaledValue = numericValue > 1 ? numericValue : numericValue * 100;
  return Math.max(0, Math.min(100, Math.round(scaledValue)));
}

export interface DetailedRequirementsBrainGovernanceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: Translate;
  brainDecisionId?: string;
  decisionSource: string;
  brainStatus: BrainStatus;
  classification: string;
  classificationConfidence?: number | null;
}

export interface DetailedRequirementsBrainApprovalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: Translate;
  brainDecisionId?: string;
  brainStatus: BrainStatus;
  brainApprovalAction: 'approve' | 'revise' | 'reject';
  onBrainApprovalActionChange: (action: 'approve' | 'revise' | 'reject') => void;
  actionItems: ActionItem[];
  selectedActionKeys: string[];
  onSelectAllActions: () => void;
  onActionCheckedChange: (key: string, checked: boolean) => void;
  brainApprovalNotes: string;
  onBrainApprovalNotesChange: (notes: string) => void;
  onSubmitApproval: () => void;
  isSubmittingApproval: boolean;
  canSubmitApproval: boolean;
  showExecuteActions: boolean;
  onExecuteActions: () => void;
  isExecutingActions: boolean;
  canExecuteActions: boolean;
  executionReceipts: ExecutionReceipt[];
}

export function DetailedRequirementsBrainGovernanceDrawer({
  open,
  onOpenChange,
  t,
  brainDecisionId,
  decisionSource,
  brainStatus,
  classification,
  classificationConfidence,
}: DetailedRequirementsBrainGovernanceDrawerProps) {
  const confidencePercent = normalizePercentValue(classificationConfidence);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HexagonLogoFrame px={20} />
            {t('demand.tabs.requirements.coreviaBrainGovernance')}
          </SheetTitle>
          <SheetDescription>
            {t('demand.tabs.requirements.governanceDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('demand.tabs.requirements.decisionSpine')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('demand.tabs.requirements.decisionId')}</span>
                <span className="font-mono">{brainDecisionId || t('demand.tabs.requirements.notAvailable')}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('demand.tabs.requirements.pipelineSource')}</span>
                <span>{decisionSource}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('demand.tabs.requirements.status')}</span>
                <Badge className={brainStatus.badgeClass}>{brainStatus.label}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('demand.tabs.requirements.dataHandling')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('demand.tabs.requirements.classification')}</span>
                <span className="capitalize">{classification}</span>
              </div>
              {confidencePercent !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('demand.tabs.requirements.confidence')}</span>
                  <span>{confidencePercent}%</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('demand.tabs.requirements.redactionGateway')}</span>
                <Badge variant="outline" className="text-xs">{t('demand.tabs.requirements.enabled')}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('demand.tabs.requirements.nextGate')}</span>
                <span>{brainStatus.nextGate}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('demand.tabs.requirements.attestations')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('demand.tabs.requirements.runAttestation')}</span>
                <Badge variant="outline" className="text-xs">{t('demand.tabs.requirements.recorded')}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('demand.tabs.requirements.redactionReceipt')}</span>
                <Badge variant="outline" className="text-xs">{t('demand.tabs.requirements.recorded')}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('demand.tabs.requirements.attestationsDescription')}
              </p>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DetailedRequirementsBrainApprovalDrawer({
  open,
  onOpenChange,
  t,
  brainDecisionId,
  brainStatus,
  brainApprovalAction,
  onBrainApprovalActionChange,
  actionItems,
  selectedActionKeys,
  onSelectAllActions,
  onActionCheckedChange,
  brainApprovalNotes,
  onBrainApprovalNotesChange,
  onSubmitApproval,
  isSubmittingApproval,
  canSubmitApproval,
  showExecuteActions,
  onExecuteActions,
  isExecutingActions,
  canExecuteActions,
  executionReceipts,
}: DetailedRequirementsBrainApprovalDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t('demand.tabs.requirements.layer7ApprovalGate')}
          </SheetTitle>
          <SheetDescription>
            {t('demand.tabs.requirements.layer7Description')}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('demand.tabs.requirements.decisionContext')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('demand.tabs.requirements.decisionId')}</span>
                <span className="font-mono">{brainDecisionId || t('demand.tabs.requirements.notAvailable')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('demand.tabs.requirements.status')}</span>
                <Badge className={brainStatus.badgeClass}>{brainStatus.label}</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Label className="text-sm">{t('demand.tabs.requirements.approvalAction')}</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={brainApprovalAction === 'approve' ? 'default' : 'outline'}
                onClick={() => onBrainApprovalActionChange('approve')}
                className="justify-center"
              >
                {t('demand.tabs.requirements.approve')}
              </Button>
              <Button
                type="button"
                variant={brainApprovalAction === 'revise' ? 'default' : 'outline'}
                onClick={() => onBrainApprovalActionChange('revise')}
                className="justify-center"
              >
                {t('demand.tabs.requirements.revise')}
              </Button>
              <Button
                type="button"
                variant={brainApprovalAction === 'reject' ? 'destructive' : 'outline'}
                onClick={() => onBrainApprovalActionChange('reject')}
                className="justify-center"
              >
                {t('demand.tabs.requirements.reject')}
              </Button>
            </div>
          </div>

          {brainApprovalAction === 'approve' && actionItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{t('demand.tabs.requirements.approvedActions')}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onSelectAllActions}
                >
                  {t('demand.tabs.requirements.selectAll')}
                </Button>
              </div>
              <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                {actionItems.map((item) => (
                  <div key={item.key} className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedActionKeys.includes(item.key)}
                      onCheckedChange={(checked) => onActionCheckedChange(item.key, Boolean(checked))}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.label}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="brain-approval-notes">{t('demand.tabs.requirements.approvalNotes')}</Label>
            <Textarea
              id="brain-approval-notes"
              value={brainApprovalNotes}
              onChange={(event) => onBrainApprovalNotesChange(event.target.value)}
              placeholder={t('demand.tabs.requirements.captureDecisionRationale')}
              className="min-h-[120px]"
            />
          </div>

          <Button
            onClick={onSubmitApproval}
            disabled={isSubmittingApproval || !canSubmitApproval}
            className="w-full gap-2"
          >
            {isSubmittingApproval ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('demand.tabs.requirements.recordingDecision')}
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {t('demand.tabs.requirements.submitGovernanceAction')}
              </>
            )}
          </Button>

          {showExecuteActions && (
            <Button
              variant="outline"
              onClick={onExecuteActions}
              disabled={isExecutingActions || !canExecuteActions}
              className="w-full gap-2"
            >
              {isExecutingActions ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Executing Actions
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Execute Approved Actions
                </>
              )}
            </Button>
          )}

          {executionReceipts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('demand.tabs.requirements.executionReceipts')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {executionReceipts.map((exec, index) => (
                  <div key={String(exec.id ?? index)} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{String(exec.actionType || exec.action || `Action ${index + 1}`)}</span>
                    <Badge variant="outline" className="text-xs">
                      {String(exec.status || 'completed').toLowerCase()}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}