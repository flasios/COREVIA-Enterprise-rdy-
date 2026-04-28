import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { CheckCircle2, Loader2, Shield } from "lucide-react";

type ApprovalAction = "approve" | "revise" | "reject";

interface BrainStatus {
  badgeClass: string;
  label: string;
  nextGate: string;
}

interface ActionItem {
  key: string;
  label: string;
  description: string;
}

interface ActionExecution {
  id?: string | number;
  actionType?: string;
  status?: string;
}

interface StrategicFitGovernanceSheetsProps {
  showBrainGovernance: boolean;
  onShowBrainGovernanceChange: (open: boolean) => void;
  showBrainApproval: boolean;
  onShowBrainApprovalChange: (open: boolean) => void;
  brainDecisionId?: string | null;
  decisionSource: string;
  brainStatus: BrainStatus;
  classification: string;
  classificationConfidencePercent: number | null;
  brainApprovalAction: ApprovalAction;
  onBrainApprovalActionChange: (action: ApprovalAction) => void;
  actionItems: ActionItem[];
  selectedActionKeys: string[];
  onSelectAllActionKeys: () => void;
  onToggleActionKey: (key: string, checked: boolean) => void;
  brainApprovalNotes: string;
  onBrainApprovalNotesChange: (notes: string) => void;
  onSubmitApproval: () => void;
  isSubmittingApproval: boolean;
  canSubmitApproval: boolean;
  showExecuteApprovedActions: boolean;
  onExecuteApprovedActions: () => void;
  isExecutingApprovedActions: boolean;
  canExecuteApprovedActions: boolean;
  actionExecutions: ActionExecution[];
  approvalNotesLabel: string;
  approvalNotesPlaceholder: string;
}

export function StrategicFitGovernanceSheets({
  showBrainGovernance,
  onShowBrainGovernanceChange,
  showBrainApproval,
  onShowBrainApprovalChange,
  brainDecisionId,
  decisionSource,
  brainStatus,
  classification,
  classificationConfidencePercent,
  brainApprovalAction,
  onBrainApprovalActionChange,
  actionItems,
  selectedActionKeys,
  onSelectAllActionKeys,
  onToggleActionKey,
  brainApprovalNotes,
  onBrainApprovalNotesChange,
  onSubmitApproval,
  isSubmittingApproval,
  canSubmitApproval,
  showExecuteApprovedActions,
  onExecuteApprovedActions,
  isExecutingApprovedActions,
  canExecuteApprovedActions,
  actionExecutions,
  approvalNotesLabel,
  approvalNotesPlaceholder,
}: StrategicFitGovernanceSheetsProps) {
  return (
    <>
      <Sheet open={showBrainGovernance} onOpenChange={onShowBrainGovernanceChange}>
        <SheetContent side="right" className="w-[420px] sm:w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <HexagonLogoFrame px={20} />
              Corevia Brain Governance
            </SheetTitle>
            <SheetDescription>
              Decision spine governance for this strategic fit analysis.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Decision Spine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Decision ID</span>
                  <span className="font-mono">{brainDecisionId || "Not available"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pipeline Source</span>
                  <span>{decisionSource}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={brainStatus.badgeClass}>{brainStatus.label}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Data Handling</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Classification</span>
                  <span className="capitalize">{classification}</span>
                </div>
                {classificationConfidencePercent !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Confidence</span>
                    <span>{classificationConfidencePercent}%</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Redaction Gateway</span>
                  <Badge variant="outline" className="text-xs">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Next Gate</span>
                  <span>{brainStatus.nextGate}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Attestations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Run attestation</span>
                  <Badge variant="outline" className="text-xs">Recorded</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Redaction receipt</span>
                  <Badge variant="outline" className="text-xs">Recorded</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Attestations are stored in the Brain audit trail for compliance and verification.
                </p>
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showBrainApproval} onOpenChange={onShowBrainApprovalChange}>
        <SheetContent side="right" className="w-[420px] sm:w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Layer 7 Approval Gate
            </SheetTitle>
            <SheetDescription>
              Record governance approvals or request revisions.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Decision Context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Decision ID</span>
                  <span className="font-mono">{brainDecisionId || "Not available"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={brainStatus.badgeClass}>{brainStatus.label}</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Label className="text-sm">Approval Action</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={brainApprovalAction === "approve" ? "default" : "outline"}
                  onClick={() => onBrainApprovalActionChange("approve")}
                  className="justify-center"
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant={brainApprovalAction === "revise" ? "default" : "outline"}
                  onClick={() => onBrainApprovalActionChange("revise")}
                  className="justify-center"
                >
                  Revise
                </Button>
                <Button
                  type="button"
                  variant={brainApprovalAction === "reject" ? "destructive" : "outline"}
                  onClick={() => onBrainApprovalActionChange("reject")}
                  className="justify-center"
                >
                  Reject
                </Button>
              </div>
            </div>

            {brainApprovalAction === "approve" && actionItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Approved Actions</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onSelectAllActionKeys}
                  >
                    Select all
                  </Button>
                </div>
                <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                  {actionItems.map((item) => (
                    <div key={item.key} className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedActionKeys.includes(item.key)}
                        onCheckedChange={(checked) => onToggleActionKey(item.key, checked === true)}
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
              <Label htmlFor="brain-approval-notes">{approvalNotesLabel}</Label>
              <Textarea
                id="brain-approval-notes"
                value={brainApprovalNotes}
                onChange={(event) => onBrainApprovalNotesChange(event.target.value)}
                placeholder={approvalNotesPlaceholder}
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
                  Recording Decision
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Submit Governance Action
                </>
              )}
            </Button>

            {showExecuteApprovedActions && (
              <Button
                variant="outline"
                onClick={onExecuteApprovedActions}
                disabled={isExecutingApprovedActions || !canExecuteApprovedActions}
                className="w-full gap-2"
              >
                {isExecutingApprovedActions ? (
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

            {actionExecutions.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Execution Receipts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {actionExecutions.map((execution, index) => (
                    <div key={execution.id || index} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{execution.actionType || `Action ${index + 1}`}</span>
                      <Badge variant="outline" className="text-xs">
                        {String(execution.status || "completed").toLowerCase()}
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