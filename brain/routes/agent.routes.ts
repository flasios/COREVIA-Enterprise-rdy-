/**
 * Agent routes — CRUD, execution, spine events, sub-decision events, history, stats.
 * Mounted at /api/corevia  (prefix handled by parent router).
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { coreviaStorage } from "../storage";
import { userHasAllEffectivePermissions, type Permission, type Role, type CustomPermissions } from "@shared/permissions";
import { agentRuntime } from "../agents/agent-runtime";
import { authorizePlannedAgentExecution } from "../agents/agent-authorization";
import { getControlPlaneState } from "../control-plane";
import {
  getUserClearanceLevel,
  enforceTenantDecisionSpineAccess,
  spineOrchestrator,
} from "./helpers";

const router = Router();

function requireRunPermission(req: Request, res: Response): boolean {
  const user = (req as unknown as { user?: { role?: Role; customPermissions?: CustomPermissions | null } }).user;
  const session = (req as unknown as { session?: { role?: Role } }).session;
  const role = user?.role || session?.role;

  if (!role) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return false;
  }

  const requiredPermissions: Permission[] = ["brain:run"];
  const allowed = userHasAllEffectivePermissions(role, requiredPermissions, user?.customPermissions || null);
  if (!allowed) {
    res.status(403).json({ success: false, error: "Insufficient permissions" });
    return false;
  }

  return true;
}

// ── Zod schemas ────────────────────────────────────────────────────────

const RegisterAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  capabilities: z.array(z.string()).min(1),
  requiredClassification: z.enum(["public", "internal", "confidential", "sovereign"]).default("internal"),
  category: z.string().default("custom"),
});

const AgentExecuteSchema = z.object({
  agentId: z.string().min(1),
  task: z.string().min(1),
  parameters: z.record(z.any()).optional(),
  decisionId: z.string().optional(),
  approvalId: z.string().optional(),
  mode: z.enum(["read", "plan", "execute"]).optional(),
});

const SpineEventSchema = z.object({
  event: z.enum([
    "DEMAND_SUBMITTED",
    "SUBDECISION_APPROVED",
    "SUBDECISION_REJECTED",
    "SUBDECISION_RESUBMITTED",
    "SF_APPROVED",
    "SF_REJECTED",
    "CONVERSION_APPROVED",
    "EXECUTION_SUCCEEDED",
    "SPINE_CANCELLED",
    "OUTCOME_RECORDED",
  ]),
  payload: z.record(z.unknown()).optional(),
});

const SubDecisionEventSchema = z.object({
  event: z.enum([
    "SUBMIT_FOR_REVIEW",
    "APPROVE",
    "REVISE",
    "REJECT",
    "EDIT_NEW_VERSION",
  ]),
  payload: z.record(z.unknown()).optional(),
});

// ── GET /agents ────────────────────────────────────────────────────────

router.get("/agents", async (_req: Request, res: Response) => {
  try {
    const agentsWithConfig = agentRuntime.listAgentsWithConfig();
    const agents = agentsWithConfig.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      capabilities: a.capabilities,
      requiredClassification: a.requiredClassification,
      status: a.config.enabled ? "active" : "inactive",
      config: a.config,
    }));

    const stats = agentRuntime.getAgentStats();

    res.json({
      success: true,
      agents,
      stats,
      count: agents.length,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: "Failed to list agents",
    });
  }
});

// ── PATCH /agents/:agentId/toggle ──────────────────────────────────────

router.patch("/agents/:agentId/toggle", async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ success: false, error: "enabled must be a boolean" });
    }
    const success = agentRuntime.toggleAgent(agentId, enabled);
    if (!success) {
      return res.status(404).json({ success: false, error: "Agent not found" });
    }
    res.json({ success: true, agentId, enabled });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Failed to toggle agent" });
  }
});

// ── PATCH /agents/:agentId/config ──────────────────────────────────────

router.patch("/agents/:agentId/config", async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const updates = req.body;
    const success = agentRuntime.updateAgentConfig(agentId, updates);
    if (!success) {
      return res.status(404).json({ success: false, error: "Agent not found" });
    }
    const config = agentRuntime.getAgentConfig(agentId);
    res.json({ success: true, agentId, config });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Failed to update agent config" });
  }
});

// ── POST /agents/register ──────────────────────────────────────────────

router.post("/agents/register", async (req: Request, res: Response) => {
  try {
    const validated = RegisterAgentSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ success: false, error: "Validation failed", details: validated.error.errors });
    }
    const { id, name, description, capabilities, requiredClassification, category } = validated.data;

    const existing = agentRuntime.getAgent(id);
    if (existing) {
      return res.status(409).json({ success: false, error: "Agent with this ID already exists" });
    }

    agentRuntime.registerAgent({
      id,
      name,
      description,
      capabilities,
      requiredClassification,
      execute: async (input) => {
        const startTime = Date.now();
        return {
          success: true,
          result: { message: `Custom agent ${name} executed`, task: input.task, parameters: input.parameters },
          reasoning: `Custom agent ${name} processed task: ${input.task}`,
          confidence: 0.7,
          executionTimeMs: Date.now() - startTime,
        };
      },
    }, { category, isBuiltIn: false });

    res.json({ success: true, message: `Agent ${name} registered`, agentId: id });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Failed to register agent" });
  }
});

// ── DELETE /agents/:agentId ────────────────────────────────────────────

router.delete("/agents/:agentId", async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const success = agentRuntime.removeAgent(agentId);
    if (!success) {
      return res.status(400).json({ success: false, error: "Cannot remove built-in agent or agent not found" });
    }
    res.json({ success: true, agentId });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Failed to remove agent" });
  }
});

// ── POST /agents/execute ───────────────────────────────────────────────

router.post("/agents/execute", async (req: Request, res: Response) => {
  try {
    const controlPlane = getControlPlaneState();
    if (controlPlane.agentThrottle <= 0) {
      return res.status(423).json({
        success: false,
        error: "Agent execution is paused by the Brain control plane",
      });
    }
    const validated = AgentExecuteSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.errors,
      });
    }

    const { agentId, task, parameters, decisionId, approvalId, mode } = validated.data;
    const userObj = (req as unknown as Record<string, unknown>).user as Record<string, unknown> | undefined;
    const userId = (userObj?.id as string) || "anonymous";
    const requestedMode = (mode || "read") as "read" | "plan" | "execute";

    let planSnapshot: Record<string, unknown> | null = null;
    let policyResult: string | null = null;
    let contextResult: string | null = null;
    let approvalSnapshot: { status?: string | null; approvalId?: string | null } | null = null;
    let decisionCorrelationId: string | null = null;
    let classificationLevel = getUserClearanceLevel(req);

    if (decisionId) {
      const fullDecision = await coreviaStorage.getFullDecisionWithLayers(decisionId);
      if (!fullDecision.decision) {
        return res.status(404).json({ success: false, error: "Decision not found" });
      }

      policyResult = (fullDecision.policy as Record<string, unknown>)?.result as string | null;
      contextResult = (fullDecision.context as Record<string, unknown>)?.result as string | null;
      planSnapshot = {
        selectedAgents: ((fullDecision.orchestration as Record<string, unknown>)?.agentPlan as Record<string, unknown> | undefined)?.selectedAgents || [],
      };
      approvalSnapshot = fullDecision.approval
        ? { status: (fullDecision.approval as Record<string, unknown>).status as string | null, approvalId: (fullDecision.approval as Record<string, unknown>).approvalId as string | null }
        : null;
      decisionCorrelationId = fullDecision.decision.correlationId || null;
      classificationLevel = (fullDecision.classification as Record<string, unknown>)?.classificationLevel as typeof classificationLevel || classificationLevel;

      if (approvalId && approvalSnapshot?.approvalId !== approvalId) {
        return res.status(400).json({ success: false, error: "Invalid approval ID" });
      }
    }

    const authorization = authorizePlannedAgentExecution({
      runtimeAgentId: agentId,
      requestedMode,
      policyResult,
      contextResult,
      plan: planSnapshot,
      approval: approvalSnapshot,
      allowDirect: !decisionId,
    });

    if (!authorization.allowed) {
      return res.status(403).json({
        success: false,
        error: authorization.reason || "Agent execution not authorized",
      });
    }

    const result = await agentRuntime.execute(agentId, {
      task,
      context: {
        decisionId: decisionId || `direct-${Date.now()}`,
        correlationId: decisionCorrelationId || `corr-${Date.now()}`,
        classificationLevel,
        tenantId: (req as unknown as Record<string, unknown>).tenantId as string || "default",
        userId,
        metadata: {
          mode: requestedMode,
          approvalId: approvalId || approvalSnapshot?.approvalId,
          directExecution: !decisionId,
        },
      },
      parameters: {
        ...parameters,
        mode: requestedMode,
        approvalId: approvalId || approvalSnapshot?.approvalId,
      },
    });

    res.json({
      success: result.success,
      userClearance: classificationLevel,
      mode: requestedMode,
      result: result.result,
      reasoning: result.reasoning,
      confidence: result.confidence,
      executionTimeMs: result.executionTimeMs,
      errors: result.errors,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: "Agent execution failed",
    });
  }
});

// ── POST /spines/:decisionSpineId/events ───────────────────────────────

router.post("/spines/:decisionSpineId/events", async (req: Request, res: Response) => {
  try {
    if (!requireRunPermission(req, res)) return;

    const decisionSpineId = req.params.decisionSpineId as string;
    if (!(await enforceTenantDecisionSpineAccess(req, res, decisionSpineId))) return;

    const validated = SpineEventSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.errors,
      });
    }

    const spineUserObj = (req as unknown as Record<string, unknown>).user as Record<string, unknown> | undefined;
    const spineSessionObj = (req as unknown as Record<string, unknown>).session as Record<string, unknown> | undefined;
    const actorId = (spineUserObj?.id as string) || (spineSessionObj?.userId as string) || "system";
    const result = await spineOrchestrator.handleSpineEvent({
      decisionSpineId,
      event: validated.data.event,
      actorId,
      payload: validated.data.payload || {},
    });

    res.json({ success: true, state: result.state, changed: result.changed });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process spine event",
    });
  }
});

// ── POST /subdecisions/:subDecisionId/events ───────────────────────────

router.post("/subdecisions/:subDecisionId/events", async (req: Request, res: Response) => {
  try {
    if (!requireRunPermission(req, res)) return;

    const subDecisionId = req.params.subDecisionId as string;
    const subDecision = await coreviaStorage.getSubDecision(subDecisionId);
    if (!subDecision) {
      return res.status(404).json({ success: false, error: "Sub-decision not found" });
    }
    if (!(await enforceTenantDecisionSpineAccess(req, res, subDecision.decisionSpineId))) return;

    const validated = SubDecisionEventSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.errors,
      });
    }

    const subUserObj = (req as unknown as Record<string, unknown>).user as Record<string, unknown> | undefined;
    const subSessionObj = (req as unknown as Record<string, unknown>).session as Record<string, unknown> | undefined;
    const actorId = (subUserObj?.id as string) || (subSessionObj?.userId as string) || "system";
    const result = await spineOrchestrator.handleSubDecisionEvent({
      subDecisionId,
      event: validated.data.event,
      actorId,
      payload: validated.data.payload || {},
    });

    res.json({
      success: true,
      state: result.state,
      changed: result.changed,
      subDecisionId: result.subDecisionId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process sub-decision event",
    });
  }
});

// ── GET /agents/history ────────────────────────────────────────────────

router.get("/agents/history", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const agentId = req.query.agentId as string;
    const history = agentId
      ? agentRuntime.getAgentExecutionHistory(agentId, limit)
      : agentRuntime.getExecutionHistory(limit);

    const mapped = history.map(h => ({
      agentId: h.agentId,
      timestamp: h.timestamp,
      success: h.output.success,
      confidence: h.output.confidence,
      executionTimeMs: h.output.executionTimeMs,
      task: h.input.task,
      errors: h.output.errors,
    }));

    res.json({
      success: true,
      history: mapped,
      count: mapped.length,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: "Failed to get execution history",
    });
  }
});

// ── GET /agents/stats ──────────────────────────────────────────────────

router.get("/agents/stats", async (_req: Request, res: Response) => {
  try {
    const stats = agentRuntime.getAgentStats();
    res.json({ success: true, ...stats });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Failed to get agent stats" });
  }
});

export default router;
