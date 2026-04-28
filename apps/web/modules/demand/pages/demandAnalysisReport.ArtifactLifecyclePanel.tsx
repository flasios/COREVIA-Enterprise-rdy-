import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DemandArtifactLifecycle } from "./demandAnalysisReport.types";
import { CheckCircle2, FileStack, GitBranch, ShieldAlert, ShieldCheck, Workflow } from "lucide-react";

interface ArtifactLifecyclePanelProps {
  readonly lifecycle?: DemandArtifactLifecycle | null;
  readonly decisionSource: string;
  readonly classification?: string | null;
  readonly policyApprovalPending?: boolean;
}

function resolvePhaseBadgeClass(phase: DemandArtifactLifecycle["phase"]): string {
  switch (phase) {
    case "approved_artifact":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "validated_draft":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300";
    case "clarification_required":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "draft_candidate":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  }
}

export function ArtifactLifecyclePanel({ lifecycle, decisionSource, classification, policyApprovalPending = false }: Readonly<ArtifactLifecyclePanelProps>) {
  if (!lifecycle) {
    return null;
  }

  const effectiveExecutionEligible = lifecycle.executionEligible && !policyApprovalPending;
  const isAwaitingAcknowledgement = !lifecycle.executionEligible && (
    lifecycle.workflowStatus === "generated" ||
    lifecycle.workflowStatus === "resubmitted"
  );
  const executionSummary = policyApprovalPending && !isAwaitingAcknowledgement
    ? "Awaiting Decision Spine approval"
    : effectiveExecutionEligible
      ? "Approved for downstream execution"
      : isAwaitingAcknowledgement
        ? "Awaiting demand acknowledgement"
        : "Still in review and governance flow";
  const executionDescription = policyApprovalPending && !isAwaitingAcknowledgement
    ? "The demand workflow acknowledgement is separate and recorded. The Brain policy still requires PMO Director approval on the Decision Spine."
    : effectiveExecutionEligible
      ? "Demand acknowledgement is complete and the Brain governance path is pre-approved."
      : isAwaitingAcknowledgement
        ? policyApprovalPending
          ? "Acknowledge the demand information first; the Decision Spine approval remains a separate PMO Director gate."
          : "Use the Acknowledge action in Demand Information to clear the acknowledgement gate."
        : "This demand is still governed by the current workflow state.";
  const phaseLabel = policyApprovalPending && !isAwaitingAcknowledgement ? "Decision Spine Approval Pending" : lifecycle.phaseLabel;
  const phaseDescription = policyApprovalPending && !isAwaitingAcknowledgement
    ? "Acknowledgement and Brain governance are tracked separately. This demand is acknowledged, but policy-enforced Decision Spine approval is still pending."
    : lifecycle.phaseDescription;
  const phaseBadgeClass = policyApprovalPending && !isAwaitingAcknowledgement
    ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
    : resolvePhaseBadgeClass(lifecycle.phase);
  const displayedLayer = policyApprovalPending ? 7 : lifecycle.currentLayer;
  const displayedArtifactStatus = policyApprovalPending ? "PENDING_APPROVAL" : lifecycle.artifactStatus;

  return (
    <Card className="border border-border/60 bg-gradient-to-br from-white/90 via-slate-50/80 to-sky-50/70 dark:from-slate-950/70 dark:via-slate-900/70 dark:to-slate-950/70" data-testid="artifact-lifecycle-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4 text-primary" />
              Demand Artifact State
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {phaseDescription}
            </p>
          </div>
          <Badge className={phaseBadgeClass} data-testid="artifact-phase-badge">
            {phaseLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-background/70 p-3" data-testid="artifact-state-current">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" />
              Current State
            </div>
            <div className="font-medium">{phaseLabel}</div>
            <p className="mt-1 text-xs text-muted-foreground">Workflow: {lifecycle.workflowStatus || "unknown"}</p>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/70 p-3" data-testid="artifact-state-source">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <FileStack className="h-3.5 w-3.5" />
              Visible Source
            </div>
            <div className="font-medium">{lifecycle.sourceLabel}</div>
            <p className="mt-1 text-xs text-muted-foreground">{lifecycle.sourceDescription}</p>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/70 p-3" data-testid="artifact-state-engine">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Engine Path
            </div>
            <div className="font-medium">{lifecycle.primaryPluginName || lifecycle.primaryEngineKind || decisionSource}</div>
            <p className="mt-1 text-xs text-muted-foreground">Classification: {classification || "internal"}</p>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/70 p-3" data-testid="artifact-state-execution">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              {effectiveExecutionEligible ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              Execution Gate
            </div>
            <div className="font-medium">{executionSummary}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {executionDescription}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {displayedLayer !== null && (
            <Badge variant="outline" data-testid="artifact-current-layer">Current layer: L{displayedLayer}</Badge>
          )}
          {displayedArtifactStatus && (
            <Badge variant="outline" data-testid="artifact-status">Artifact status: {displayedArtifactStatus}</Badge>
          )}
          {lifecycle.artifactVersion !== null && (
            <Badge variant="outline" data-testid="artifact-version">Artifact v{lifecycle.artifactVersion}</Badge>
          )}
          {lifecycle.missingFieldsCount > 0 && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300" data-testid="artifact-missing-fields">
              {lifecycle.missingFieldsCount} governed field{lifecycle.missingFieldsCount === 1 ? "" : "s"} still open
            </Badge>
          )}
          {lifecycle.decisionId && (
            <Badge variant="outline" data-testid="artifact-decision-id">Decision spine: {lifecycle.decisionId}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
