import type { AgentInput, AgentOutput, AgentDefinition } from "./agent-runtime";

interface SyncAction {
  id: string;
  type: string;
  target: string;
  payload: Record<string, unknown>;
  status: "pending" | "executed" | "failed" | "skipped";
  result?: unknown;
  error?: string;
}

interface PlanAction {
  id?: string;
  type?: string;
  target?: string;
  payload?: Record<string, unknown>;
}

function toPlanAction(action: unknown): PlanAction {
  if (typeof action !== "object" || action === null) {
    return {};
  }
  return action as PlanAction;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export const portfolioSyncAgent: AgentDefinition = {
  id: "portfolio-sync-agent",
  name: "Portfolio Sync Agent",
  description: "Bridges portfolio integration in two modes: PLAN (prepare execution plan) and EXECUTE (Layer 8 only, approved side effects).",
  capabilities: ["portfolio_update", "workflow_trigger", "system_integration", "notification_dispatch"],
  requiredClassification: "internal",

  execute: async (input: AgentInput): Promise<AgentOutput> => {
    const startTime = Date.now();

    try {
      const parameters = input.parameters || {};
      const mode = String(parameters.mode || input.context.metadata?.mode || "read").toLowerCase();
      const layer = Number(input.context.metadata?.layer || 0);
      const approvalId = typeof parameters.approvalId === "string" ? parameters.approvalId : undefined;
      const approvedActions = Array.isArray(parameters.approvedActions) ? parameters.approvedActions : [];

      if (mode === "execute") {
        if (layer !== 8) {
          return {
            success: false,
            result: null,
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            errors: ["EXECUTE mode allowed only in Layer 8"],
          };
        }

        if (!approvalId) {
          return {
            success: false,
            result: null,
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            errors: ["ApprovalID required for execute mode"],
          };
        }
      }

      if (mode === "plan" || mode === "read") {
        const draftActions = buildDraftExecutionPlan(input, approvedActions);
        return {
          success: true,
          result: {
            mode: mode.toUpperCase(),
            writePermissions: false,
            executionPlan: draftActions,
            idempotencyKeys: draftActions.map((action) => `${input.context.decisionId}_${action.type}_${action.id}`),
            summary: {
              total: draftActions.length,
              readyForApproval: draftActions.length > 0,
            },
          },
          reasoning: `Prepared ${draftActions.length} planned portfolio sync action(s) with no side effects`,
          confidence: 0.92,
          executionTimeMs: Date.now() - startTime,
        };
      }

      if (mode !== "execute") {
        return {
          success: false,
          result: null,
          confidence: 0,
          executionTimeMs: Date.now() - startTime,
          errors: [`Unsupported mode: ${mode}`],
        };
      }

      const syncActions: SyncAction[] = [];

      for (const action of approvedActions) {
        const typedAction = toPlanAction(action);
        const syncAction: SyncAction = {
          id: `SYNC-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: typedAction.type || "unknown",
          target: typedAction.target || "portfolio",
          payload: typedAction.payload || (action as Record<string, unknown>),
          status: "pending",
        };

        try {
          switch (syncAction.type) {
            case "portfolio_create":
              syncAction.result = await simulatePortfolioCreate(syncAction.payload);
              syncAction.status = "executed";
              break;
            case "portfolio_update":
              syncAction.result = await simulatePortfolioUpdate(syncAction.payload);
              syncAction.status = "executed";
              break;
            case "workflow_trigger":
              syncAction.result = await simulateWorkflowTrigger(syncAction.payload);
              syncAction.status = "executed";
              break;
            case "notification":
              syncAction.result = await simulateNotification(syncAction.payload);
              syncAction.status = "executed";
              break;
            default:
              syncAction.status = "skipped";
              syncAction.result = { reason: "Unknown action type" };
          }
        } catch (err) {
          syncAction.status = "failed";
          syncAction.error = err instanceof Error ? err.message : "Execution failed";
        }

        syncActions.push(syncAction);
      }

      const executed = syncActions.filter((a) => a.status === "executed").length;
      const failed = syncActions.filter((a) => a.status === "failed").length;
      const skipped = syncActions.filter((a) => a.status === "skipped").length;

      return {
        success: failed === 0,
        result: {
          syncActions,
          summary: {
            total: syncActions.length,
            executed,
            failed,
            skipped,
            mode: "EXECUTE",
          },
          auditLog: syncActions.map((a) => ({
            actionId: a.id,
            type: a.type,
            status: a.status,
            timestamp: new Date().toISOString(),
            approvalId: approvalId || null,
            decisionId: input.context.decisionId,
          })),
        },
        reasoning: `Executed ${executed} actions, ${failed} failed, ${skipped} skipped`,
        confidence: failed === 0 ? 1.0 : (executed / syncActions.length),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        confidence: 0,
        executionTimeMs: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : "Portfolio sync failed"],
      };
    }
  },
};

function buildDraftExecutionPlan(input: AgentInput, approvedActions: unknown[]): Array<{ id: string; type: string; target: string; payload: Record<string, unknown> }> {
  const params = input.parameters || {};
  const actionCandidates = Array.isArray(approvedActions) && approvedActions.length > 0
    ? approvedActions
    : [
        {
          id: `PLAN-${Date.now()}-portfolio`,
          type: "portfolio_create",
          target: "portfolio",
          payload: {
            projectName: params.projectName || params.title || "Not recorded",
            sourceDecisionId: input.context.decisionId,
          },
        },
      ];

  return actionCandidates.map((action: unknown, index: number) => {
    const typedAction = toPlanAction(action);
    return {
      id: String(typedAction.id || `PLAN-${Date.now()}-${index}`),
      type: String(typedAction.type || "portfolio_update"),
      target: String(typedAction.target || "portfolio"),
      payload: typedAction.payload || (action as Record<string, unknown>),
    };
  });
}

async function simulatePortfolioCreate(payload: Record<string, unknown>): Promise<unknown> {
  await delay(50);
  return {
    portfolioItemId: `PI-${Date.now()}`,
    created: true,
    payload,
  };
}

async function simulatePortfolioUpdate(payload: Record<string, unknown>): Promise<unknown> {
  await delay(30);
  return {
    updated: true,
    fieldsUpdated: Object.keys(payload),
  };
}

async function simulateWorkflowTrigger(payload: Record<string, unknown>): Promise<unknown> {
  await delay(40);
  return {
    workflowId: `WF-${Date.now()}`,
    triggered: true,
    workflowName: payload.workflowName || "default",
  };
}

async function simulateNotification(payload: Record<string, unknown>): Promise<unknown> {
  await delay(20);
  return {
    notificationId: `NOTIF-${Date.now()}`,
    sent: true,
    recipients: asStringArray(payload.recipients).length > 0 ? asStringArray(payload.recipients) : ["system"],
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
