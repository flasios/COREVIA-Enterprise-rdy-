/**
 * Intelligence Module — AI Routes (buildDeps + useCases)
 *
 * Canonical AI route composition for the intelligence domain.
 */
import { Router } from "express";
import { z } from "zod";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import type { AIAssistantStorageSlice } from "../application/buildDeps";
import {
  buildAIDeps,
  evaluateEvidence,
  sendEvidenceEmail,
  getTaskCompletionGuidance,
  generateDeploymentStrategy,
  translateText,
  coveriaGenerateDemand,
} from "../application";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";

/* ─── Zod Schemas ───────────────────────────────────────────── */

const evaluateEvidenceSchema = z.object({
  taskId: z.string().optional(),
  taskName: z.string().optional(),
  taskDescription: z.string().optional(),
  deliverables: z.array(z.string()).optional(),
  evidence: z.array(z.any()).optional(),
});

const sendEvidenceEmailSchema = z.object({
  recipientEmail: z.string().min(1),
  recipientName: z.string().optional(),
  taskName: z.string().optional(),
  projectName: z.string().optional(),
  analysis: z.record(z.unknown()).optional(),
  emailType: z.string().optional(),
  senderName: z.string().optional(),
  additionalMessage: z.string().optional(),
});

const taskCompletionAdvisorSchema = z.object({
  taskName: z.string().optional(),
  taskDescription: z.string().optional(),
  taskType: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  deliverables: z.array(z.string()).optional(),
  percentComplete: z.number().optional(),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  linkedRisksCount: z.number().optional(),
  linkedIssuesCount: z.number().optional(),
  projectName: z.string().optional(),
});

const deploymentStrategySchema = z.object({
  projectName: z.string().optional(),
  projectType: z.string().optional(),
  taskCount: z.number().optional(),
  completedTasks: z.number().optional(),
  hasIntegrations: z.any().optional(),
  hasMigration: z.any().optional(),
  hasTraining: z.any().optional(),
  taskType: z.string().optional(),
  taskPriority: z.string().optional(),
});

const translateSchema = z.object({
  text: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
});

const coveriaGenerateDemandSchema = z.object({
  description: z.string().min(1),
  requestorName: z.string().optional(),
  requestorEmail: z.string().optional(),
  department: z.string().optional(),
  departmentName: z.string().optional(),
  organizationName: z.string().optional(),
  organizationType: z.string().optional(),
});

const setDefaultProviderSchema = z.object({
  provider: z.enum(["anthropic", "openai", "falcon"]),
});

/* ─── Routes ────────────────────────────────────────────────── */

export function createAIRoutes(storage?: AIAssistantStorageSlice): Router {
  const router = Router();
  const auth = storage ? createAuthMiddleware(storage) : null;
  const deps = buildAIDeps();

  router.post("/evaluate-evidence", validateBody(evaluateEvidenceSchema), async (req, res) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const result = await evaluateEvidence(deps, req.body, req.session.userId);
      if (!result.success) return res.status(result.status).json(result);
      res.json({ success: true, analysis: result.data });
    } catch (error) {
      logger.error("[AI Evidence] Evaluation error:", error);
      res.status(500).json({ error: "Failed to evaluate evidence" });
    }
  });

  router.post("/send-evidence-email", validateBody(sendEvidenceEmailSchema), async (req, res) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const result = await sendEvidenceEmail(deps, req.body);
      if (!result.success) return res.status(result.status).json({ error: result.error });
      res.json(result.data);
    } catch (error) {
      logger.error("[AI Evidence] Email send error:", error);
      res.status(500).json({ error: "Failed to send evidence email" });
    }
  });

  router.post("/task-completion-advisor", validateBody(taskCompletionAdvisorSchema), async (req, res) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const result = await getTaskCompletionGuidance(deps, req.body, req.session.userId);
      if (!result.success) return res.status(result.status).json(result);
      res.json({ success: true, guidance: result.data });
    } catch (error) {
      logger.error("[AI Task Advisor] Error:", error);
      res.status(500).json({ error: "Failed to generate task guidance" });
    }
  });

  router.post("/deployment-strategy", validateBody(deploymentStrategySchema), async (req, res) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const result = generateDeploymentStrategy(req.body);
      if (!result.success) return res.status(result.status).json(result);
      res.json({ success: true, recommendation: result.data });
    } catch (error) {
      logger.error("[AI Deployment] Strategy error:", error);
      res.status(500).json({ error: "Failed to generate deployment recommendation" });
    }
  });

  const translateMiddleware = auth ? [auth.requirePermission("report:read")] : [];
  router.post("/translate", ...translateMiddleware, validateBody(translateSchema), async (req, res) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const result = await translateText(deps, req.body, req.session.userId);
      if (!result.success) return res.status(result.status).json(result);
      res.json({ success: true, ...result.data });
    } catch (error) {
      logger.error("Translation error:", error);
      res.status(500).json({ success: false, error: "Translation failed", translatedText: req.body.text });
    }
  });

  router.post("/coveria-generate-demand", validateBody(coveriaGenerateDemandSchema), async (req, res) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const result = await coveriaGenerateDemand(deps, req.body, req.session.userId);
      if (!result.success) return res.status(result.status).json(result);
      res.json({ success: true, ...result.data });
    } catch (error) {
      logger.error("[Coveria] Error generating demand:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to generate demand" });
    }
  });

  // ── Provider diagnostic endpoints ──────────────────────────────────────────

  router.get("/providers/status", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const { anthropic: anthropicAvailable, openai: openaiAvailable, falcon: falconAvailable } =
        await deps.providerStatus.checkAvailability();

      const currentProvider = process.env.LLM_PROVIDER || "anthropic";
      const embeddingProvider = process.env.EMBEDDING_PROVIDER || "openai";
      const providers = [
        { id: "anthropic", name: "Anthropic Claude", model: "Claude Sonnet 4", type: "external", status: anthropicAvailable ? "active" : "unavailable", isDefault: currentProvider === "anthropic", configured: !!(process.env.ANTHROPIC_API_KEY_COREVIA_ || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_2 || process.env.CLAUDE_API_KEY), hasBackup: !!process.env.ANTHROPIC_API_KEY_2, capabilities: ["text-generation", "streaming", "business-case", "requirements", "strategic-fit"] },
        { id: "openai", name: "OpenAI GPT", model: "GPT-5", type: "external", status: openaiAvailable ? "active" : "unavailable", isDefault: currentProvider === "openai", configured: !!process.env.OPENAI_API_KEY, hasBackup: false, capabilities: ["text-generation", "streaming", "embeddings"] },
        { id: "falcon", name: "UAE Falcon LLM", model: "Falcon 180B", type: "sovereign", status: falconAvailable ? "active" : "unavailable", isDefault: currentProvider === "falcon", configured: !!process.env.FALCON_API_URL, hasBackup: false, capabilities: ["text-generation", "streaming", "synergy-detection", "tender-generation"] },
        { id: "private", name: "Private Enterprise LLM", model: "Custom", type: "private", status: "not_configured", isDefault: false, configured: false, hasBackup: false, capabilities: ["text-generation"] },
      ];

      const agents = [
        { id: "business-case-agent", name: "Business Case Generator", category: "generation", provider: "anthropic", status: anthropicAvailable ? "active" : "standby" },
        { id: "requirements-agent", name: "Requirements Analyst", category: "analysis", provider: "anthropic", status: anthropicAvailable ? "active" : "standby" },
        { id: "strategic-fit-agent", name: "Strategic Fit Analyzer", category: "analysis", provider: "anthropic", status: anthropicAvailable ? "active" : "standby" },
        { id: "finance-agent", name: "Finance Agent", category: "optimization", provider: "anthropic", status: anthropicAvailable ? "active" : "standby" },
        { id: "wbs-agent", name: "WBS Generator", category: "generation", provider: "anthropic", status: anthropicAvailable ? "active" : "standby" },
        { id: "tender-agent", name: "RFP/Tender Generator", category: "generation", provider: "falcon", status: falconAvailable ? "active" : "standby" },
        { id: "synergy-detector", name: "Cross-Dept Synergy Detector", category: "optimization", provider: "falcon", status: falconAvailable ? "active" : "standby" },
        { id: "innovation-recommender", name: "Innovation Recommender", category: "optimization", provider: "falcon", status: falconAvailable ? "active" : "standby" },
        { id: "portfolio-optimizer", name: "Portfolio Optimizer", category: "optimization", provider: "falcon", status: falconAvailable ? "active" : "standby" },
        { id: "knowledge-assistant", name: "Knowledge Assistant", category: "analysis", provider: "anthropic", status: anthropicAvailable ? "active" : "standby" },
        { id: "self-validator", name: "Self Validator", category: "automation", provider: "anthropic", status: anthropicAvailable ? "active" : "standby" },
        { id: "feedback-learner", name: "Feedback Learner", category: "automation", provider: "anthropic", status: "learning" },
        { id: "coveria-advisor", name: "Coveria Strategic Advisor", category: "analysis", provider: "anthropic", status: anthropicAvailable ? "active" : "standby" },
      ];

      res.json({
        success: true, currentProvider, embeddingProvider, providers, agents,
        statistics: { totalAgents: agents.length, activeAgents: agents.filter((a) => a.status === "active").length, providersConfigured: providers.filter((p) => p.configured).length },
      });
    } catch (error) {
      logger.error("[AI Providers] Status check error:", error);
      res.status(500).json({ success: false, error: "Failed to check provider status" });
    }
  });

  router.post("/providers/set-default", validateBody(setDefaultProviderSchema), async (req, res) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    const { provider } = req.body;
    res.json({ success: true, message: `Provider preference set to ${provider}. Note: Full provider switching requires environment variable update.`, provider });
  });

  router.get("/providers/health", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const startTime = Date.now();
      const { anthropic: isAvailable } = await deps.providerStatus.checkAvailability();
      res.json({ success: true, health: { overall: isAvailable ? "healthy" : "degraded", latency: Date.now() - startTime, timestamp: new Date().toISOString(), primaryProvider: process.env.LLM_PROVIDER || "anthropic", primaryAvailable: isAvailable } });
    } catch { res.status(500).json({ success: false, error: "Health check failed" }); }
  });

  return router;
}
