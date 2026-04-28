/**
 * Global blocked-generation dialog.
 *
 * Mounted once at the app root. When any AI artifact generation (Business Case,
 * Requirements, Strategic Fit) is blocked by the COREVIA Brain pipeline (Layer 3
 * approval required, timeout, blocked status, etc.), the API returns HTTP 409 with
 * a structured `GENERATION_BLOCKED` payload. The query client throws a
 * `BlockedGenerationError` that any `useMutation` consumer can forward to this
 * store via `openBlockedGenerationDialog(payload)`. This dialog renders a
 * professional explanation with the exact reasons + 3 user actions:
 *   1. Retry generation
 *   2. Request governance approval
 *   3. Use deterministic template (opt-in fallback)
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Clock,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BlockedGenerationError } from "@/lib/queryClient";

type BlockedPayload = BlockedGenerationError["payload"];

type ActionId = BlockedPayload["actions"][number]["id"];
type ActionHandler = (actionId: ActionId, payload: BlockedPayload) => Promise<void> | void;

interface BlockedDialogState {
  open: boolean;
  payload: BlockedPayload | null;
  loadingAction: ActionId | null;
  onAction: ActionHandler | null;
}

const listeners = new Set<(state: BlockedDialogState) => void>();
let currentState: BlockedDialogState = {
  open: false,
  payload: null,
  loadingAction: null,
  onAction: null,
};

function setState(next: Partial<BlockedDialogState>) {
  currentState = { ...currentState, ...next };
  for (const l of listeners) l(currentState);
}

function subscribe(listener: (state: BlockedDialogState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Imperatively pop the dialog with a given payload + action handler. Safe to call
 * from React Query mutation `onError` callbacks where hooks are not available.
 */
export function openBlockedGenerationDialog(
  payload: BlockedPayload,
  onAction?: ActionHandler,
): void {
  setState({ open: true, payload, onAction: onAction || null, loadingAction: null });
}

function hideDialog() {
  setState({ open: false, payload: null, onAction: null, loadingAction: null });
}

function reasonIcon(code: string) {
  if (code.startsWith("GOVERNANCE") || code.startsWith("POLICY")) {
    return <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />;
  }
  if (code === "PIPELINE_TIMEOUT") {
    return <Clock className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />;
  }
  if (code === "AI_DRAFT_UNAVAILABLE" || code === "PIPELINE_BLOCKED") {
    return <Lock className="h-4 w-4 text-rose-600 mt-0.5 flex-shrink-0" />;
  }
  return <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5 flex-shrink-0" />;
}

function actionIcon(id: ActionId) {
  if (id === "retry") return <RotateCcw className="h-4 w-4" />;
  if (id === "request_approval") return <ShieldCheck className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function actionVariant(id: ActionId): "default" | "outline" | "secondary" {
  if (id === "retry") return "default";
  if (id === "request_approval") return "secondary";
  return "outline";
}

export function BlockedGenerationDialog() {
  const [state, setLocalState] = useState<BlockedDialogState>(currentState);
  useEffect(() => subscribe(setLocalState), []);
  const { open, payload, loadingAction, onAction } = state;

  const handleAction = useCallback(
    async (actionId: ActionId) => {
      if (!payload) return;
      if (!onAction) {
        hideDialog();
        return;
      }
      try {
        setState({ loadingAction: actionId });
        await onAction(actionId, payload);
        hideDialog();
      } catch (err) {
        setState({ loadingAction: null });
        // eslint-disable-next-line no-console
        console.error("[BlockedGenerationDialog] action handler threw", err);
      }
    },
    [payload, onAction],
  );

  if (!payload) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : hideDialog())}>
      <DialogContent className="sm:max-w-2xl" data-testid="blocked-generation-dialog">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">{payload.title}</DialogTitle>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="font-normal">
                  {payload.artifactLabel}
                </Badge>
                {payload.context?.brainStatus && typeof payload.context.brainStatus === "string" ? (
                  <Badge variant="secondary" className="font-mono text-xs">
                    Brain: {payload.context.brainStatus}
                  </Badge>
                ) : null}
                {typeof payload.context?.currentLayer === "number" ? (
                  <Badge variant="secondary" className="font-mono text-xs">
                    Layer {payload.context.currentLayer}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <DialogDescription className="pt-3 text-sm leading-relaxed">
            {payload.summary}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Why this generation was blocked
            </h4>
            <ol className="space-y-2 text-sm">
              {payload.reasons.map((reason, idx) => (
                <li
                  key={`${reason.code}-${idx}`}
                  className="flex gap-3 rounded-md border border-border/60 bg-muted/40 p-3"
                >
                  <span className="font-mono text-xs text-muted-foreground pt-0.5">
                    {idx + 1}.
                  </span>
                  {reasonIcon(reason.code)}
                  <div className="flex-1">
                    <div className="text-foreground">{reason.message}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <code className="rounded bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {reason.code}
                      </code>
                      {typeof reason.layer === "number" ? (
                        <code className="rounded bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Layer {reason.layer}
                        </code>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-foreground mb-2">What you can do</h4>
            <div className="space-y-2">
              {payload.actions.map((action) => (
                <div
                  key={action.id}
                  className="rounded-md border border-border/60 p-3 flex items-start gap-3"
                >
                  <div className="mt-0.5 text-muted-foreground">{actionIcon(action.id)}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{action.label}</div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={actionVariant(action.id)}
                    disabled={loadingAction !== null}
                    onClick={() => handleAction(action.id)}
                    data-testid={`blocked-generation-action-${action.id}`}
                  >
                    {loadingAction === action.id ? "Working…" : action.label}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter className="mt-4">
          <div className="flex w-full items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground font-mono">
              {payload.context?.decisionSpineId
                ? String(payload.context.decisionSpineId)
                : "no decision spine"}
            </div>
            <Button variant="ghost" size="sm" onClick={hideDialog} disabled={loadingAction !== null}>
              Dismiss
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
