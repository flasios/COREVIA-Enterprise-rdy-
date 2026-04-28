/**
 * Operations routes — control-plane, layers, intake, services.
 * Mounted at /api/corevia  (prefix handled by parent router).
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { coreviaOrchestrator } from "../pipeline/orchestrator";
import { coreviaStorage } from "../storage";
import { intakePluginSystem, IntakeRequestSchema } from "../plugins/intake-plugin-system";
import {
  getControlPlaneState,
  setAgentThrottle,
  setIntakeEnabled,
  setPolicyMode,
  getLayerConfigs,
  getLayerConfig,
  updateLayerConfig,
  loadLayerConfigsFromDB,
} from "../control-plane";
import { demandSyncService } from "../services/demand-sync-service";
import { logger } from "../../platform/observability";

const router = Router();

// ── Control-plane ──────────────────────────────────────────────────────

router.get("/control-plane", async (_req: Request, res: Response) => {
  await loadLayerConfigsFromDB();
  res.json({ success: true, state: getControlPlaneState() });
});

router.patch("/control-plane/intake", async (req: Request, res: Response) => {
  const { enabled } = req.body as { enabled?: boolean };
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ success: false, error: "enabled must be a boolean" });
  }
  const state = setIntakeEnabled(enabled);
  res.json({ success: true, state });
});

router.patch("/control-plane/policy-mode", async (req: Request, res: Response) => {
  const { mode } = req.body as { mode?: "enforce" | "monitor" };
  if (mode !== "enforce" && mode !== "monitor") {
    return res.status(400).json({ success: false, error: "mode must be enforce or monitor" });
  }
  const state = setPolicyMode(mode);
  res.json({ success: true, state });
});

router.patch("/control-plane/agent-throttle", async (req: Request, res: Response) => {
  const { throttle } = req.body as { throttle?: number };
  if (typeof throttle !== "number" || Number.isNaN(throttle)) {
    return res.status(400).json({ success: false, error: "throttle must be a number" });
  }
  const state = setAgentThrottle(throttle);
  res.json({ success: true, state });
});

// ── Layer Config (Decision Spine™) ─────────────────────────────────────

router.get("/layers", async (_req: Request, res: Response) => {
  await loadLayerConfigsFromDB();
  res.json({ success: true, layers: getLayerConfigs() });
});

router.get("/layers/:layerId", async (req: Request, res: Response) => {
  const layerId = parseInt(req.params.layerId as string, 10);
  const layer = getLayerConfig(layerId);
  if (!layer) return res.status(404).json({ success: false, error: "Layer not found" });
  res.json({ success: true, layer });
});

router.patch("/layers/:layerId", async (req: Request, res: Response) => {
  const layerId = parseInt(req.params.layerId as string, 10);
  const updated = updateLayerConfig(layerId, req.body);
  if (!updated) return res.status(404).json({ success: false, error: "Layer not found" });
  res.json({ success: true, layer: updated });
});

// ── Intake ─────────────────────────────────────────────────────────────

router.get("/intake/plugins", async (_req: Request, res: Response) => {
  try {
    const plugins = intakePluginSystem.listPlugins().map(p => ({
      id: p.id,
      name: p.name,
      version: p.version,
      supportedSources: p.supportedSources,
      supportedTypes: p.supportedTypes,
      priority: p.priority,
    }));

    res.json({
      success: true,
      plugins,
      count: plugins.length,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: "Failed to list plugins",
    });
  }
});

router.post("/intake/process", async (req: Request, res: Response) => {
  try {
    const controlPlane = getControlPlaneState();
    if (!controlPlane.intakeEnabled) {
      return res.status(423).json({
        success: false,
        error: "Intake is currently paused by the Brain control plane",
      });
    }
    const validated = IntakeRequestSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.errors,
      });
    }

    const normalized = await intakePluginSystem.processIntake(validated.data);

    res.json({
      success: true,
      normalized,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Intake processing failed",
    });
  }
});

router.post("/intake/:serviceId/:routeKey", async (req: Request, res: Response) => {
  try {
    const controlPlane = getControlPlaneState();
    if (!controlPlane.intakeEnabled) {
      return res.status(423).json({
        success: false,
        error: "Intake is currently paused by the Brain control plane",
      });
    }
    const serviceId = req.params.serviceId as string;
    const routeKey = req.params.routeKey as string;
    const userId = req.tenant?.userId || req.auth?.userId || "anonymous";
    const organizationId = req.tenant?.organizationId || undefined;

    const result = await coreviaOrchestrator.execute(
      serviceId,
      routeKey,
      req.body,
      userId,
      organizationId
    );

    let demandSyncResult = null;
    const demandServiceIds = ["demand-intake", "demand_management", "demand-request"];
    const needsMoreInfo = result.finalStatus === "needs_info";

    if (demandServiceIds.includes(serviceId) && result.success && result.decisionId && !needsMoreInfo) {
      demandSyncResult = await demandSyncService.syncDecisionToDemandCollection(result.decisionId, userId);
      logger.info(`[COREVIA Intake] Demand sync result:`, demandSyncResult);
    }

    const redirectUrl = needsMoreInfo
      ? undefined
      : "/intelligent-library?section=demands";

    res.status(result.success ? 200 : 422).json({
      ...result,
      redirectUrl,
      needsMoreInfo,
      missingFields: result.missingFields || [],
      demandSync: demandSyncResult,
      message: needsMoreInfo
        ? "Additional information required to complete your request"
        : "Your request has been submitted and is being processed",
    });
  } catch (error) {
    logger.error("[COREVIA API] Intake error:", error);
    res.status(500).json({
      success: false,
      error: "Intake processing failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ── Services ───────────────────────────────────────────────────────────

const RegisterServiceSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required").regex(/^[a-z0-9_]+$/, "Service ID must be lowercase with underscores only"),
  serviceName: z.string().min(1, "Service name is required"),
  description: z.string().optional(),
  defaultClassification: z.enum(["public", "internal", "confidential", "sovereign"]).default("internal"),
  requiredPermissions: z.array(z.string()).optional().default([]),
  isActive: z.boolean().default(true),
});

router.get("/services", async (_req: Request, res: Response) => {
  try {
    const registeredServices = await coreviaStorage.listRegisteredServices();

    const defaultServices = [
      { serviceId: "demand_management", serviceName: "DEMAND_REQUEST", description: "Demand intake & normalization through governance pipeline", isActive: true, defaultClassification: "internal" as const, requiredPermissions: ["demand:read", "demand:write"], version: "1.0.0" },
      { serviceId: "business_case", serviceName: "BUSINESS_CASE", description: "AI-powered business case generation with financial modeling", isActive: true, defaultClassification: "internal" as const, requiredPermissions: ["business_case:read", "business_case:write"], version: "1.0.0" },
      { serviceId: "requirements_analysis", serviceName: "DEMAND_DECISION", description: "Requirements analysis — spine decision for demand journey", isActive: true, defaultClassification: "internal" as const, requiredPermissions: ["demand:read", "demand:write"], version: "1.0.0" },
      { serviceId: "assessment", serviceName: "ASSESSMENT", description: "Strategic fit and requirements analysis engine", isActive: false, defaultClassification: "internal" as const, requiredPermissions: [], version: "-" },
      { serviceId: "hr", serviceName: "HR Decision Support", description: "HR-related decision support and compliance", isActive: false, defaultClassification: "internal" as const, requiredPermissions: [], version: "-" },
    ];

    const services = registeredServices.length > 0
      ? registeredServices.map((service) => {
          const registeredService = service as Record<string, unknown>;
          return {
            serviceId: registeredService.useCaseType,
            name: registeredService.title,
            description: registeredService.description || "",
            enabled: true,
            version: "1.0.0",
            classification: (registeredService.allowedMaxClass as string)?.toLowerCase() || "internal",
            registeredAt: registeredService.createdAt,
          };
        })
      : defaultServices.map(s => ({
          serviceId: s.serviceId,
          name: s.serviceName,
          description: s.description,
          enabled: s.isActive,
          version: s.version,
          classification: s.defaultClassification,
          registeredAt: null,
        }));

    res.json({
      success: true,
      services,
      total: services.length,
    });
  } catch (error) {
    logger.error("[COREVIA API] Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

router.post("/services/register", async (req: Request, res: Response) => {
  try {
    const validated = RegisterServiceSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.errors,
      });
    }

    const existing = await coreviaStorage.getRegisteredService(validated.data.serviceId);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Service '${validated.data.serviceId}' already exists`,
      });
    }

    const service = await coreviaStorage.registerService({
      serviceId: validated.data.serviceId,
      serviceName: validated.data.serviceName,
      description: validated.data.description || null,
      defaultClassification: validated.data.defaultClassification,
      requiredPermissions: validated.data.requiredPermissions,
      isActive: validated.data.isActive,
    }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    res.status(201).json({
      success: true,
      message: `Service '${service.serviceName}' registered successfully`,
      service: {
        serviceId: service.serviceId,
        name: service.serviceName,
        description: service.description,
        enabled: service.isActive,
        version: "1.0.0",
        classification: service.defaultClassification,
        registeredAt: service.createdAt,
      },
    });
  } catch (error) {
    logger.error("[COREVIA API] Error registering service:", error);
    res.status(500).json({
      success: false,
      error: "Failed to register service",
    });
  }
});

router.patch("/services/:serviceId/toggle", async (req: Request, res: Response) => {
  try {
    const serviceId = req.params.serviceId as string;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "isActive must be a boolean",
      });
    }

    const updated = await coreviaStorage.updateServiceStatus(serviceId, isActive) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Service not found",
      });
    }

    res.json({
      success: true,
      message: `Service '${serviceId}' ${isActive ? "activated" : "deactivated"}`,
      service: {
        serviceId: updated.serviceId,
        name: updated.serviceName,
        enabled: updated.isActive,
      },
    });
  } catch (error) {
    logger.error("[COREVIA API] Error toggling service:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle service status",
    });
  }
});

export default router;
