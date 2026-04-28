/**
 * Learning routes — artifacts, backfill, outcome-feedback, seed, R1 learning, RAG.
 * Mounted at /api/corevia  (prefix handled by parent router).
 */
import { Router, Request, Response } from "express";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { z } from "zod";
import { coreviaOrchestrator } from "../pipeline/orchestrator";
import { coreviaStorage } from "../storage";
import { ragGateway } from "../intelligence/rag-gateway";
import { Layer8Memory } from "../layers/layer8-memory";
import { r1LearningEngine } from "../../domains/intelligence/infrastructure/r1LearningEngine";
import { r1LearningScheduler } from "../../domains/intelligence/infrastructure/r1LearningScheduler";
import { getUserClearanceLevel } from "./helpers";
import { logger } from "../../platform/observability";

const router = Router();

// ── Zod schemas ────────────────────────────────────────────────────────

const RAGQuerySchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().optional().default(5),
});

const OutcomeFeedbackSchema = z.object({
  decisionId: z.string().min(1),
  approvalId: z.string().min(1),
  outcomeStatus: z.string().min(1),
  lessonsLearned: z.string().optional(),
});

function serializeSafeJsonlRecord(record: unknown): string {
  return JSON.stringify(record)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

// ── RAG ────────────────────────────────────────────────────────────────

router.post("/rag/query", async (req: Request, res: Response) => {
  try {
    const validated = RAGQuerySchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.errors,
      });
    }

    const { query, maxResults } = validated.data;
    const classificationLevel = getUserClearanceLevel(req);

    const results = await ragGateway.retrieve({
      query,
      context: { intent: query },
      classificationLevel,
      maxResults,
    });

    res.json({
      success: true,
      userClearance: classificationLevel,
      ...results,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: "RAG query failed",
    });
  }
});

router.get("/rag/stats", async (_req: Request, res: Response) => {
  res.json({
    success: true,
    documentCount: ragGateway.getDocumentCount(),
    status: "operational",
  });
});

// ── Learning artifacts ─────────────────────────────────────────────────

router.get("/learning/artifacts", async (_req: Request, res: Response) => {
  try {
    const artifacts = await coreviaStorage.getLearningArtifacts();

    res.json({
      success: true,
      artifacts,
      total: artifacts.length,
    });
  } catch (error) {
    logger.error("[COREVIA API] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch learning artifacts",
    });
  }
});

router.post("/learning/backfill", async (_req: Request, res: Response) => {
  try {
    const decisions = await coreviaStorage.listDecisions();
    const approvedDecisions = decisions.filter(d => d.status === "memory" || d.status === "action_execution" || d.status === "completed");

    const results: Record<string, unknown>[] = [];
    const layer8 = new Layer8Memory();

    for (const decision of approvedDecisions) {
      const existingMemory = await coreviaStorage.getFullDecisionWithLayers(decision.id);
      if ((existingMemory.memory as Record<string, unknown>)?.decisionSummary) {
        results.push({ decisionId: decision.id, status: "skipped", reason: "memory already exists" });
        continue;
      }

      try {
        const fullDecision = existingMemory;
        const approval = fullDecision.approval as Record<string, unknown>;
        const bfClassification = fullDecision.classification as Record<string, unknown>;
        const bfPolicy = fullDecision.policy as Record<string, unknown>;
        const bfContext = fullDecision.context as Record<string, unknown>;
        const bfAdvisory = fullDecision.advisory as Record<string, unknown>;

        const decisionObject: Record<string, unknown> = {
          decisionId: decision.id,
          correlationId: decision.correlationId,
          currentLayer: 8,
          status: "memory",
          input: {
            serviceId: decision.serviceId,
            routeKey: decision.routeKey,
            rawInput: decision.inputData,
            normalizedInput: decision.normalizedInput || decision.inputData,
          },
          classification: bfClassification ? {
            classificationLevel: bfClassification.classificationLevel,
            sector: bfClassification.sector,
            jurisdiction: bfClassification.jurisdiction,
            riskLevel: bfClassification.riskLevel,
            constraints: bfClassification.constraints || {},
            classificationReason: bfClassification.classificationReason,
          } : undefined,
          policy: bfPolicy ? {
            result: bfPolicy.result,
            policiesEvaluated: bfPolicy.policiesEvaluated || [],
          } : undefined,
          context: bfContext ? {
            result: bfContext.result,
            completenessScore: Number(bfContext.completenessScore),
          } : undefined,
          advisory: bfAdvisory ? {
            options: bfAdvisory.options || [],
            risks: bfAdvisory.risks || [],
            evidence: bfAdvisory.evidence || [],
            assumptions: bfAdvisory.assumptions || [],
            proposedActions: bfAdvisory.proposedActions || [],
            overallConfidence: Number(bfAdvisory.overallConfidence || 0),
            confidenceBreakdown: bfAdvisory.confidenceBreakdown,
          } : undefined,
          validation: {
            status: "approved",
            approvalId: approval?.approvalId || `APR-${decision.id.slice(0, 8)}`,
            approvedBy: approval?.approvedBy || "system",
            approvalReason: approval?.approvalReason || "",
            approvedActions: approval?.approvedActions || [],
          },
          audit: { events: [] },
          createdAt: decision.createdAt?.toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const layer8Result = await layer8.execute(decisionObject as any); // eslint-disable-line @typescript-eslint/no-explicit-any

        if (layer8Result.success && layer8Result.data) {
          const memoryData = layer8Result.data as Record<string, unknown>;
          await coreviaStorage.saveMemoryEntry({
            decisionId: decision.id,
            decisionSummary: memoryData.decisionSummary as string || null,
            evidence: memoryData.evidence as Record<string, unknown> || {},
            rationale: memoryData.rationale as string || null,
            learningExtracted: memoryData.learningExtracted as boolean || false,
            learningArtifactIds: memoryData.learningArtifactIds as string[] || null,
            tags: memoryData.tags as string[] || null,
          });

          await coreviaStorage.addAuditEvent(
            decision.id,
            decision.correlationId,
            8,
            "layer8_learning_backfill",
            {
              learningExtracted: memoryData.learningExtracted,
              artifactsCreated: (memoryData.learningArtifactIds as string[] | undefined)?.length || 0,
              tagsCount: (memoryData.tags as string[] | undefined)?.length || 0,
            },
            "system"
          );

          results.push({
            decisionId: decision.id,
            status: "backfilled",
            learningExtracted: memoryData.learningExtracted,
            artifacts: (memoryData.learningArtifactIds as string[] | undefined)?.length || 0,
            tags: (memoryData.tags as string[] | undefined)?.length || 0,
          });
        }
      } catch (err) {
        results.push({ decisionId: decision.id, status: "error", error: err instanceof Error ? err.message : "Unknown" });
      }
    }

    res.json({ success: true, message: `Backfilled ${results.filter(r => r.status === "backfilled").length} decisions`, results });
  } catch (error) {
    logger.error("[COREVIA API] Backfill error:", error);
    res.status(500).json({ success: false, error: "Backfill failed" });
  }
});

router.post("/learning/artifacts/:artifactId/activate", async (req: Request, res: Response) => {
  try {
    const artifactId = req.params.artifactId as string;
    const userId = (req as unknown as Record<string, unknown>).user as Record<string, unknown> | undefined;
    const userIdStr = userId?.id as string || "anonymous";

    const _result = await coreviaStorage.activateLearningArtifact(artifactId, userIdStr);

    res.json({
      success: true,
      message: "Artifact activated successfully",
      artifactId,
      activatedAt: new Date().toISOString(),
      activatedBy: userId,
    });
  } catch (error) {
    logger.error("[COREVIA API] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to activate learning artifact",
    });
  }
});

router.post("/learning/outcome-feedback", async (req: Request, res: Response) => {
  try {
    const validated = OutcomeFeedbackSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.errors,
      });
    }

    const { decisionId, approvalId, outcomeStatus, lessonsLearned } = validated.data;
    const feedbackUserObj = (req as unknown as Record<string, unknown>).user as Record<string, unknown> | undefined;
    const userId = (feedbackUserObj?.id as string) || "anonymous";

    await coreviaStorage.saveOutcomeFeedback({
      decisionId,
      approvalId,
      outcomeStatus,
      lessonsLearned,
      submittedBy: userId,
      submittedAt: new Date(),
    });

    res.json({
      success: true,
      message: "Outcome feedback submitted successfully",
    });
  } catch (error) {
    logger.error("[COREVIA API] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to submit outcome feedback",
    });
  }
});

// ── Seed endpoint ──────────────────────────────────────────────────────

router.post("/seed", async (_req: Request, res: Response) => {
  try {
    const allowSeed = String(process.env.COREVIA_ENABLE_DEMO_SEED || "").toLowerCase() === "true";
    const isDev = process.env.NODE_ENV !== "production";
    if (!allowSeed || !isDev) {
      return res.status(403).json({
        success: false,
        error: "Demo seeding is disabled",
        hint: "Set COREVIA_ENABLE_DEMO_SEED=true in a non-production environment to enable /api/corevia/seed",
      });
    }

    const seededDecisions = [];

    const sampleInputs = [
      {
        serviceId: "demand_management",
        routeKey: "demand.new",
        input: {
          projectName: "AI Document Processing System",
          description: "Implement AI-powered document classification and extraction for government forms",
          estimatedBudget: "500000",
          department: "Digital Services",
          businessObjective: "Reduce manual processing time by 80%",
        },
      },
      {
        serviceId: "business_case",
        routeKey: "business_case.generate",
        input: {
          projectName: "Smart City Traffic Management",
          description: "Deploy AI traffic optimization system across 50 intersections",
          strategicAlignment: "UAE Vision 2071 - Smart Infrastructure",
          financialDetails: { budget: 2500000, expectedROI: 340 },
        },
      },
      {
        serviceId: "assessment",
        routeKey: "assessment.strategic_fit",
        input: {
          projectName: "Citizen Services Portal",
          objectives: ["Improve citizen experience", "Reduce processing times", "Enable 24/7 access"],
        },
      },
    ];

    for (const sample of sampleInputs) {
      try {
        const result = await coreviaOrchestrator.execute(
          sample.serviceId,
          sample.routeKey,
          sample.input,
          "seed-user",
          "demo-org"
        );
        seededDecisions.push({
          ...sample,
          decisionId: result.decisionId,
          status: result.finalStatus,
        });
      } catch (err) {
        logger.error(`[COREVIA Seed] Error seeding ${sample.serviceId}:`, err);
      }
    }

    const sampleArtifacts = [
      {
        id: "art-seed-001",
        artifactType: "decision_pattern",
        version: "1.0",
        status: "draft",
        createdFromDecisionId: seededDecisions[0]?.decisionId || "D-SEED-001",
        createdAt: new Date().toISOString(),
      },
      {
        id: "art-seed-002",
        artifactType: "risk_template",
        version: "1.0",
        status: "draft",
        createdFromDecisionId: seededDecisions[1]?.decisionId || "D-SEED-002",
        createdAt: new Date().toISOString(),
      },
      {
        id: "art-seed-003",
        artifactType: "cost_model",
        version: "1.0",
        status: "draft",
        createdFromDecisionId: seededDecisions[2]?.decisionId || "D-SEED-003",
        createdAt: new Date().toISOString(),
      },
    ];

    for (const artifact of sampleArtifacts) {
      await coreviaStorage.saveLearningArtifact(artifact);
    }

    res.json({
      success: true,
      message: "Seed data created successfully",
      seededDecisions,
      seededArtifacts: sampleArtifacts.length,
    });
  } catch (error) {
    logger.error("[COREVIA API] Seed error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to seed data",
    });
  }
});

// ── R1 Learning Engine ─────────────────────────────────────────────────

router.get("/r1-learning/status", async (_req: Request, res: Response) => {
  try {
    const engineStatus = r1LearningEngine.getStatus();
    const schedulerStatus = r1LearningScheduler.getStatus();
    const insights = r1LearningEngine.getInsights();

    res.json({
      success: true,
      engine: {
        ...engineStatus,
        provider: "DeepSeek R1",
        model: "deepseek-reasoner",
        kind: "R1_LEARNING",
        name: "R1 Autonomous Learning Engine",
        version: "1.0.0",
        layer: 8,
        description: "Autonomous learning system that uses DeepSeek R1 to analyze decisions, generate assumptions, identify patterns, and create reasoning heuristics.",
      },
      scheduler: schedulerStatus,
      insights: {
        total: insights.length,
        byType: {
          pattern: insights.filter((i: { type: string }) => i.type === "pattern").length,
          assumption: insights.filter((i: { type: string }) => i.type === "assumption").length,
          algorithm: insights.filter((i: { type: string }) => i.type === "algorithm").length,
          risk_factor: insights.filter((i: { type: string }) => i.type === "risk_factor").length,
        },
        recent: insights.slice(-10).reverse(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to get R1 status" });
  }
});

router.get("/r1-learning/sessions", async (_req: Request, res: Response) => {
  try {
    const status = r1LearningEngine.getStatus();
    res.json({
      success: true,
      sessions: status.recentSessions,
      isRunning: status.isRunning,
      lastRunAt: status.lastRunAt,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to get sessions" });
  }
});

router.get("/r1-learning/insights", async (_req: Request, res: Response) => {
  try {
    const insights = r1LearningEngine.getInsights();
    res.json({
      success: true,
      insights,
      total: insights.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to get insights" });
  }
});

router.post("/r1-learning/trigger", async (_req: Request, res: Response) => {
  try {
    const session = await r1LearningEngine.runLearningSession();
    res.json({
      success: true,
      session,
      message: `Learning session ${session.id} completed: ${session.patternsIdentified} patterns, ${session.newAssumptions} assumptions, ${session.insightsGenerated} insights`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to trigger learning session",
    });
  }
});

router.post("/r1-learning/analyze/:decisionId", async (req: Request, res: Response) => {
  try {
    const { decisionId } = req.params;
    if (!decisionId) {
      return res.status(400).json({ success: false, error: "Missing decisionId" });
    }
    const result = await r1LearningEngine.analyzeDecision(decisionId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to analyze decision",
    });
  }
});

router.patch("/r1-learning/scheduler", async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled === "boolean") {
      r1LearningScheduler.setEnabled(enabled);
    }
    const status = r1LearningScheduler.getStatus();
    res.json({ success: true, scheduler: status });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update scheduler",
    });
  }
});

// ── Engine C Fine-Tune ─────────────────────────────────────────────────

const ENGINE_C_URL = process.env.ENGINE_C_ENDPOINT || "http://engine-c-distillation:8090";

const FineTuneRequestSchema = z.object({
  baseModel: z.string().default("mistral-nemo"),
  ollamaModelName: z.string().default("corevia-mistral-nemo"),
  loraRank: z.number().int().min(4).max(128).default(16),
  loraAlpha: z.number().int().min(4).max(256).default(32),
  loraDropout: z.number().min(0).max(0.5).default(0.05),
  learningRate: z.number().positive().max(1).default(0.0002),
  epochs: z.number().int().min(1).max(50).default(3),
  batchSize: z.number().int().min(1).max(64).default(4),
  maxSeqLength: z.number().int().min(128).max(8192).default(2048),
});

router.post("/learning/fine-tune", async (req: Request, res: Response) => {
  try {
    const validated = FineTuneRequestSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ success: false, error: "Validation failed", details: validated.error.errors });
    }

    const config = validated.data;

    // Collect training data from active learning artifacts
    const allArtifacts = await coreviaStorage.getLearningArtifacts() as Array<{
      id: string; artifactType: string; version: number; content: Record<string, unknown>;
      status: string; sourceDecisionId: string; createdAt: string; decisionPhase?: string;
    }>;

    const activeArtifacts = allArtifacts.filter((a) => a.status === "APPROVED");
    if (activeArtifacts.length < 5) {
      return res.status(400).json({
        success: false,
        error: `Need at least 5 learning artifacts for fine-tuning. Currently have ${activeArtifacts.length}.`,
      });
    }

    // Build training records in conversation format
    const trainingData: Record<string, unknown>[] = [];
    const systemPrompt = "You are COREVIA Brain, a government portfolio intelligence engine. Analyze the following decision context and produce a structured assessment.";

    for (const artifact of activeArtifacts) {
      let decisionContext: Record<string, unknown> = {};
      if (artifact.sourceDecisionId) {
        try {
          decisionContext = await coreviaStorage.getFullDecisionWithLayers(artifact.sourceDecisionId) as Record<string, unknown>;
        } catch {
          // Decision may no longer exist — skip enrichment
          decisionContext = {};
        }
      }

      const userContent = JSON.stringify({
        artifactType: artifact.artifactType,
        phase: artifact.decisionPhase || (artifact.content as Record<string, unknown>)?.decisionPhase,
        content: artifact.content,
        ...(Object.keys(decisionContext).length > 0 ? {
          decisionContext: {
            status: decisionContext.status,
            classification: decisionContext.classificationLevel,
            riskScore: decisionContext.riskScore,
          },
        } : {}),
      }, null, 2);

      const assistantContent = JSON.stringify({
        assessment: `Processed ${artifact.artifactType} artifact`,
        artifactId: artifact.id,
        version: artifact.version,
        status: artifact.status,
        recommendation: artifact.status === "APPROVED"
          ? "This pattern has been validated and activated for use in future decisions."
          : "This artifact is not yet approved for governed learning use.",
      }, null, 2);

      trainingData.push({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
          { role: "assistant", content: assistantContent },
        ],
      });
    }

    // Create tracking record in DB
    const { createLoraTrainingJob } = await import("../../interfaces/storage/repositories/learning.repository");
    const dbJob = await createLoraTrainingJob({
      datasetId: "auto-" + new Date().toISOString().slice(0, 10),
      baseModel: config.baseModel,
      loraRank: config.loraRank,
      loraAlpha: config.loraAlpha,
      loraDropout: config.loraDropout,
      learningRate: config.learningRate,
      epochs: config.epochs,
      batchSize: config.batchSize,
      status: "pending",
    });

    // Send to Engine C container
    const engineCResponse = await fetch(`${ENGINE_C_URL}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_model: config.baseModel,
        training_data: trainingData,
        ollama_model_name: config.ollamaModelName,
        lora_rank: config.loraRank,
        lora_alpha: config.loraAlpha,
        lora_dropout: config.loraDropout,
        learning_rate: config.learningRate,
        epochs: config.epochs,
        batch_size: config.batchSize,
        max_seq_length: config.maxSeqLength,
        corevia_job_id: dbJob.id,
      }),
    });

    if (!engineCResponse.ok) {
      const errText = await engineCResponse.text().catch(() => "");
      await import("../../interfaces/storage/repositories/learning.repository").then(
        (m) => m.updateLoraTrainingJob(dbJob.id, { status: "failed", errorMessage: errText.slice(0, 500) })
      );
      return res.status(502).json({
        success: false,
        error: "Engine C service unavailable",
        details: errText.slice(0, 200),
      });
    }

    const engineResult = await engineCResponse.json() as Record<string, unknown>;

    res.json({
      success: true,
      message: "Fine-tuning job started",
      job: {
        id: dbJob.id,
        engineJobId: (engineResult as Record<string, unknown>).job
          ? ((engineResult as Record<string, unknown>).job as Record<string, unknown>).id
          : undefined,
        baseModel: config.baseModel,
        ollamaModelName: config.ollamaModelName,
        trainingSamples: trainingData.length,
        status: "pending",
      },
    });
  } catch (error) {
    logger.error("[COREVIA API] Fine-tune error:", error);
    res.status(500).json({ success: false, error: "Failed to start fine-tuning" });
  }
});

router.get("/learning/fine-tune/status", async (_req: Request, res: Response) => {
  try {
    // Try Engine C container first
    const engineResponse = await fetch(`${ENGINE_C_URL}/jobs`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (engineResponse?.ok) {
      const data = await engineResponse.json() as Record<string, unknown>;
      return res.json({ success: true, source: "engine-c", ...(data as object) });
    }

    // Fallback: DB records
    const { getLoraTrainingJobsByStatus } = await import("../../interfaces/storage/repositories/learning.repository");
    const [pending, running, completed, failed] = await Promise.all([
      getLoraTrainingJobsByStatus("pending"),
      getLoraTrainingJobsByStatus("running"),
      getLoraTrainingJobsByStatus("completed"),
      getLoraTrainingJobsByStatus("failed"),
    ]);

    res.json({
      success: true,
      source: "database",
      engineAvailable: false,
      jobs: [...pending, ...running, ...completed, ...failed],
      total: pending.length + running.length + completed.length + failed.length,
    });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Failed to get fine-tuning status" });
  }
});

router.get("/learning/fine-tune/health", async (_req: Request, res: Response) => {
  try {
    const engineResponse = await fetch(`${ENGINE_C_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (engineResponse?.ok) {
      const data = await engineResponse.json();
      return res.json({ success: true, available: true, ...(data as object) });
    }

    res.json({ success: true, available: false, message: "Engine C container not running" });
  } catch {
    res.json({ success: true, available: false, message: "Engine C unreachable" });
  }
});

router.patch("/learning/fine-tune/:jobId/status", async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const { status, currentEpoch, currentStep, totalSteps, trainingLoss, error: errorMsg } = req.body;
    const { updateLoraTrainingJob } = await import("../../interfaces/storage/repositories/learning.repository");

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (typeof currentEpoch === "number") updates.currentEpoch = currentEpoch;
    if (typeof currentStep === "number") updates.currentStep = currentStep;
    if (typeof totalSteps === "number") updates.totalSteps = totalSteps;
    if (typeof trainingLoss === "number") updates.trainingLoss = trainingLoss;
    if (errorMsg) updates.errorMessage = String(errorMsg).slice(0, 2000);
    if (status === "running" || status === "training") updates.startedAt = new Date();
    if (status === "completed" || status === "failed") updates.completedAt = new Date();

    const updated = await updateLoraTrainingJob(jobId, updates as Parameters<typeof updateLoraTrainingJob>[1]);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    res.json({ success: true, job: updated });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Failed to update job status" });
  }
});

// ── LLM Tuning Export ──────────────────────────────────────────────────

const LLMExportSchema = z.object({
  format: z.enum(["jsonl", "json", "conversation"]).default("jsonl"),
  artifactIds: z.array(z.string()).optional(),
  includeDecisionContext: z.boolean().default(true),
  systemPrompt: z.string().optional().default(
    "You are COREVIA Brain, a government portfolio intelligence engine. Analyze the following decision context and produce a structured assessment."
  ),
});

router.post("/learning/llm-export", async (req: Request, res: Response) => {
  try {
    const validated = LLMExportSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.errors,
      });
    }

    const { format, artifactIds, includeDecisionContext, systemPrompt } = validated.data;

    // Fetch all artifacts (or specific ones)
    const allArtifacts = await coreviaStorage.getLearningArtifacts() as Array<{
      id: string;
      artifactType: string;
      version: number;
      content: Record<string, unknown>;
      status: string;
      sourceDecisionId: string;
      createdAt: string;
      decisionPhase?: string;
    }>;

    const artifacts = artifactIds?.length
      ? allArtifacts.filter((a) => artifactIds.includes(a.id))
      : allArtifacts;

    if (artifacts.length === 0) {
      return res.json({ success: true, records: [], total: 0, format });
    }

    // Build training records
    const records: Record<string, unknown>[] = [];

    for (const artifact of artifacts) {
      let decisionContext: Record<string, unknown> = {};

      if (includeDecisionContext && artifact.sourceDecisionId) {
        try {
          decisionContext = await coreviaStorage.getFullDecisionWithLayers(artifact.sourceDecisionId) as Record<string, unknown>;
        } catch {
          // Decision may no longer exist
        }
      }

      const userContent = JSON.stringify({
        artifactType: artifact.artifactType,
        phase: artifact.decisionPhase || (artifact.content as Record<string, unknown>)?.decisionPhase,
        content: artifact.content,
        ...(includeDecisionContext && Object.keys(decisionContext).length > 0
          ? { decisionContext: {
              status: decisionContext.status,
              classification: decisionContext.classificationLevel,
              riskScore: decisionContext.riskScore,
              layers: decisionContext.layers,
            }}
          : {}),
      }, null, 2);

      const assistantContent = JSON.stringify({
        assessment: `Processed ${artifact.artifactType} artifact`,
        artifactId: artifact.id,
        version: artifact.version,
        status: artifact.status,
        recommendation: artifact.status === "ACTIVE"
          ? "This pattern has been validated and activated for use in future decisions."
          : "This artifact is in draft status and pending review before activation.",
      }, null, 2);

      if (format === "conversation") {
        records.push({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
            { role: "assistant", content: assistantContent },
          ],
          metadata: {
            artifactId: artifact.id,
            artifactType: artifact.artifactType,
            sourceDecisionId: artifact.sourceDecisionId,
            createdAt: artifact.createdAt,
          },
        });
      } else {
        records.push({
          system: systemPrompt,
          input: userContent,
          output: assistantContent,
          metadata: {
            artifactId: artifact.id,
            artifactType: artifact.artifactType,
            sourceDecisionId: artifact.sourceDecisionId,
            createdAt: artifact.createdAt,
          },
        });
      }
    }

    if (format === "jsonl") {
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Content-Disposition", `attachment; filename="corevia-training-${new Date().toISOString().slice(0, 10)}.jsonl"`);
      const safeLines = records.map((record) => serializeSafeJsonlRecord(record));
      await pipeline(Readable.from(safeLines.join("\n")), res.type("application/x-ndjson"));
      return;
    }

    res.json({
      success: true,
      records,
      total: records.length,
      format,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[COREVIA API] LLM export error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to export LLM training data",
    });
  }
});

export default router;
