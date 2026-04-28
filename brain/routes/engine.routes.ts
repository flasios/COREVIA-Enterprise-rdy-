/**
 * Engine, redaction, and routing-override routes.
 * Mounted at /api/corevia  (prefix handled by parent router).
 */
import { Router, Request, Response } from "express";
import { execFile, spawnSync } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { coreviaStorage } from "../storage";
import { engineRouter } from "../intelligence/engine-router";
import { redactionGateway } from "../intelligence/redaction-gateway";
import { localInferenceAdapter } from "../intelligence/internal/localInferenceAdapter";
import { logger } from "../../platform/observability";
import { strictLimiter } from "../../interfaces/middleware/rateLimiter";

const router = Router();
const execFileAsync = promisify(execFile);

const DOCKER_ENGINE_A_ENDPOINT_LOCAL = "http://127.0.0.1:8080";
const DOCKER_ENGINE_A_ENDPOINT_COMPOSE = "http://engine-a-gateway:8080";

type RuntimeServiceState = "running" | "stopped";

type EngineRuntimeStatusPayload = {
  manageable: boolean;
  manager: "docker-local-llm";
  endpoint: string;
  reason?: string;
  services: {
    engineGateway: RuntimeServiceState;
    localLlm: RuntimeServiceState;
  };
  healthy: boolean;
  health?: Awaited<ReturnType<typeof localInferenceAdapter.healthCheck>>;
};

const DEFAULT_HYBRID_CONFIG = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  redactionMode: "MASK",
  redactionRequired: true,
  maxTokens: 8192,
  temperature: 0.3,
} as const;

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function sendRouteError(res: Response, error: unknown, message: string) {
  logger.warn(`[COREVIA API] ${message}:`, error);
  return res.status(500).json({ success: false, error: message });
}

function parseEnvNumber(value: string | undefined, fallback: number, min?: number, max?: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const boundedMin = min === undefined ? parsed : Math.max(min, parsed);
  return max === undefined ? boundedMin : Math.min(max, boundedMin);
}

function getRepoRoot() {
  return process.cwd();
}

function getDockerComposeDir() {
  return path.resolve(getRepoRoot(), "infrastructure", "docker");
}

function getDockerEnvFile() {
  return path.resolve(getRepoRoot(), ".env.docker.example");
}

function isDockerRuntimeManagerEligible() {
  return (process.env.NODE_ENV || "development") === "development";
}

function resolveManagedEngineEndpoint() {
  if (String(process.env.COREVIA_RUNTIME_PROFILE || "").trim() === "local-docker") {
    return DOCKER_ENGINE_A_ENDPOINT_COMPOSE;
  }
  return DOCKER_ENGINE_A_ENDPOINT_LOCAL;
}

async function runDockerCompose(args: string[]) {
  return execFileAsync("docker", [
    "compose",
    "--env-file",
    getDockerEnvFile(),
    ...args,
  ], {
    cwd: getDockerComposeDir(),
    env: {
      ...process.env,
    },
  });
}

function stopStandaloneBridgeProcesses() {
  spawnSync("pkill", ["-f", "infrastructure/scripts/lmstudio-bridge.ts"], { stdio: "ignore" });
  spawnSync("pkill", ["-f", "npm run dev:lmstudio-bridge"], { stdio: "ignore" });
}

async function getEngineRuntimeStatus(): Promise<EngineRuntimeStatusPayload> {
  const endpoint = resolveManagedEngineEndpoint();

  if (!isDockerRuntimeManagerEligible()) {
    return {
      manageable: false,
      manager: "docker-local-llm",
      endpoint,
      reason: "Runtime lifecycle management is only enabled in local development.",
      services: {
        engineGateway: "stopped",
        localLlm: "stopped",
      },
      healthy: false,
    };
  }

  try {
    const { stdout } = await runDockerCompose(["ps", "--services", "--status", "running", "engine-a-gateway", "local-llm"]);
    const running = new Set(stdout.split(/\s+/).map((entry) => entry.trim()).filter(Boolean));
    const services = {
      engineGateway: running.has("engine-a-gateway") ? "running" as const : "stopped" as const,
      localLlm: running.has("local-llm") ? "running" as const : "stopped" as const,
    };
    const health = services.engineGateway === "running"
      ? await localInferenceAdapter.healthCheck(endpoint, 3000)
      : undefined;

    return {
      manageable: true,
      manager: "docker-local-llm",
      endpoint,
      services,
      healthy: Boolean(health?.ok),
      health,
    };
  } catch (error) {
    return {
      manageable: false,
      manager: "docker-local-llm",
      endpoint,
      reason: error instanceof Error ? error.message : "Docker runtime manager unavailable",
      services: {
        engineGateway: "stopped",
        localLlm: "stopped",
      },
      healthy: false,
    };
  }
}

async function syncManagedEndpointForEngine(enginePluginId: string) {
  const engine = await coreviaStorage.getEngine(enginePluginId);
  if (engine?.kind !== "SOVEREIGN_INTERNAL") {
    return;
  }

  const config = toRecord(engine?.config);
  config.endpoint = resolveManagedEngineEndpoint();

  await coreviaStorage.updateEngine(enginePluginId, {
    config,
  });
}

async function seedDefaultEngineRegistry(
  sovereignDefaults: ReturnType<typeof resolveSovereignEngineDefaults>,
  alternateSovereign: ReturnType<typeof resolveAlternateSovereignPlugin>,
) {
  await coreviaStorage.registerEngine({
    enginePluginId: "engine-sovereign",
    kind: "SOVEREIGN_INTERNAL",
    name: "Sovereign Internal Engine",
    version: "1.0.0",
    enabled: true,
    allowedMaxClass: "SOVEREIGN",
    capabilities: {
      GENERAL_REASONING: true,
      rag: true,
      scoring: true,
      entities: true,
      patterns: true,
      localInference: true,
    },
    config: sovereignDefaults,
  });

  await coreviaStorage.registerEngine({
    enginePluginId: "engine-hybrid",
    kind: "EXTERNAL_HYBRID",
    name: "External Hybrid Engine",
    version: "1.0.0",
    enabled: true,
    allowedMaxClass: "INTERNAL",
    capabilities: {
      BUSINESS_CASE: true,
      REQUIREMENTS: true,
      STRATEGIC_FIT: true,
      WBS: true,
      GENERAL_REASONING: true,
      SUMMARIZATION: true,
      generateBusinessCase: true,
      generateRequirements: true,
      generateStrategicFit: true,
      generateWBS: true,
      summarize: true,
      score: true,
    },
    config: DEFAULT_HYBRID_CONFIG,
  });

  await coreviaStorage.registerEngine({
    enginePluginId: "engine-distillation",
    kind: "DISTILLATION",
    name: "Distillation Engine",
    version: "2.0.0",
    enabled: true,
    allowedMaxClass: "INTERNAL",
    capabilities: {
      DISTILLATION: true,
      PATTERN_EXTRACTION: true,
      TRAINING_DATA: true,
      distill: true,
      learn: true,
      crossCorrelation: true,
      trainingDataGeneration: true,
      llmDistillation: true,
    },
    config: {
      llmEnabled: process.env.COREVIA_DISTILLATION_LLM !== "false",
      engineAModel: String(process.env.COREVIA_ENGINE_A_MODEL || "mistral-nemo").trim(),
      autoDistill: process.env.COREVIA_AUTO_DISTILL !== "false",
    },
  });

  if (alternateSovereign) {
    await coreviaStorage.registerEngine(alternateSovereign);
  }

  const runPodPlugin = resolveRunPodPlugin();
  if (runPodPlugin) {
    await coreviaStorage.registerEngine(runPodPlugin);
  }

  return coreviaStorage.getAllEngines();
}

/**
 * Semaphore to ensure only one runtime lifecycle operation runs at a time,
 * preventing unbounded resource allocation from concurrent start/stop requests.
 */
let runtimeOperationLock = false;

async function withRuntimeLock<T>(fn: () => Promise<T>): Promise<T> {
  if (runtimeOperationLock) {
    throw new Error("A runtime lifecycle operation is already in progress. Please wait.");
  }
  runtimeOperationLock = true;
  try {
    return await fn();
  } finally {
    runtimeOperationLock = false;
  }
}

async function startManagedEngineRuntime(enginePluginId: string) {
  if (!isDockerRuntimeManagerEligible()) {
    throw new Error("Runtime lifecycle management is only enabled in local development.");
  }

  stopStandaloneBridgeProcesses();
  await runDockerCompose(["--profile", "ai", "--profile", "local-llm", "up", "-d", "local-llm", "engine-a-gateway"]);
  await runDockerCompose(["--profile", "local-llm", "up", "local-llm-model-pull"]);
  await syncManagedEndpointForEngine(enginePluginId);
  return getEngineRuntimeStatus();
}

async function stopManagedEngineRuntime() {
  if (!isDockerRuntimeManagerEligible()) {
    throw new Error("Runtime lifecycle management is only enabled in local development.");
  }

  stopStandaloneBridgeProcesses();
  await runDockerCompose(["stop", "engine-a-gateway", "local-llm"]);
  return getEngineRuntimeStatus();
}

async function sendEngineRuntimeStatus(res: Response, enginePluginId: string) {
  const engine = await coreviaStorage.getEngine(enginePluginId);
  if (!engine) {
    return res.status(404).json({ success: false, error: "Engine not found" });
  }
  if (engine.kind !== "SOVEREIGN_INTERNAL") {
    return res.status(400).json({ success: false, error: "Runtime lifecycle is only supported for sovereign local engines" });
  }

  const runtime = await getEngineRuntimeStatus();
  return res.json({ success: true, engine: engine.enginePluginId, runtime });
}

function resolveSovereignEngineDefaults() {
  const model = String(process.env.COREVIA_ENGINE_A_MODEL || "qwen2.5:7b").trim();
  const fastModel = String(process.env.COREVIA_ENGINE_A_FAST_MODEL || model).trim() || model;
  return {
    endpoint: String(process.env.COREVIA_ENGINE_A_ENDPOINT || "").trim(),
    model,
    fastModel,
    timeoutMs: parseEnvNumber(process.env.COREVIA_ENGINE_A_TIMEOUT_MS, 60000, 1000, 300000),
    maxTokens: parseEnvNumber(process.env.COREVIA_ENGINE_A_MAX_TOKENS, 6000, 256, 16000),
    temperature: parseEnvNumber(process.env.COREVIA_ENGINE_A_TEMPERATURE, 0.2, 0, 1),
    priority: parseEnvNumber(process.env.COREVIA_ENGINE_A_PRIORITY, 100, 1, 1000),
  };
}

function resolveAlternateSovereignPlugin() {
  const explicitlyDisabled = String(process.env.COREVIA_ENGINE_A_ALT_ENABLED || "").trim().toLowerCase() === "false";
  if (explicitlyDisabled) {
    return null;
  }
  const model = String(process.env.COREVIA_ENGINE_A_ALT_MODEL || "mistral-nemo").trim();
  if (!model) {
    return null;
  }

  const endpoint = String(process.env.COREVIA_ENGINE_A_ALT_ENDPOINT || process.env.COREVIA_ENGINE_A_ENDPOINT || "").trim();
  const fastModel = String(process.env.COREVIA_ENGINE_A_ALT_FAST_MODEL || model).trim() || model;

  return {
    enginePluginId: String(process.env.COREVIA_ENGINE_A_ALT_PLUGIN_ID || "engine-sovereign-mistral-nemo").trim(),
    kind: "SOVEREIGN_INTERNAL" as const,
    name: String(process.env.COREVIA_ENGINE_A_ALT_NAME || "Mistral Nemo Sovereign Engine").trim(),
    version: String(process.env.COREVIA_ENGINE_A_ALT_VERSION || "1.0.0").trim(),
    enabled: true,
    allowedMaxClass: "SOVEREIGN" as const,
    capabilities: {
      rag: true,
      scoring: true,
      entities: true,
      patterns: true,
      localInference: true,
    },
    config: {
      endpoint,
      model,
      fastModel,
      timeoutMs: parseEnvNumber(process.env.COREVIA_ENGINE_A_ALT_TIMEOUT_MS, 90000, 1000, 300000),
      maxTokens: parseEnvNumber(process.env.COREVIA_ENGINE_A_ALT_MAX_TOKENS, 6000, 256, 16000),
      temperature: parseEnvNumber(process.env.COREVIA_ENGINE_A_ALT_TEMPERATURE, 0.2, 0, 1),
      priority: parseEnvNumber(process.env.COREVIA_ENGINE_A_ALT_PRIORITY, 120, 1, 1000),
    },
  };
}

function mergeLocalEngineConfig(existing: Record<string, unknown>, defaults: ReturnType<typeof resolveSovereignEngineDefaults> | NonNullable<ReturnType<typeof resolveAlternateSovereignPlugin>>["config"]) {
  const existingEndpoint = typeof existing.endpoint === "string" ? existing.endpoint.trim() : "";
  const defaultEndpoint = typeof defaults.endpoint === "string" ? defaults.endpoint.trim() : "";

  return {
    endpoint: defaultEndpoint || existingEndpoint,
    model: defaults.model,
    fastModel: defaults.fastModel,
    timeoutMs: defaults.timeoutMs,
    maxTokens: Number.isFinite(Number(existing.maxTokens)) ? Number(existing.maxTokens) : defaults.maxTokens,
    temperature: Number.isFinite(Number(existing.temperature)) ? Number(existing.temperature) : defaults.temperature,
    priority: Number.isFinite(Number(existing.priority)) ? Number(existing.priority) : defaults.priority,
  };
}

function resolveRunPodPlugin() {
  const endpoint = String(process.env.COREVIA_RUNPOD_ENDPOINT || "").trim();
  const model = String(process.env.COREVIA_RUNPOD_MODEL || "casperhansen/deepseek-r1-distill-qwen-32b-awq").trim();

  // Always register the RunPod sovereign plugin so it is visible in the engine registry
  // and selectable from the routing UI. When the endpoint is not provisioned (e.g. the
  // RunPod gateway profile is not started), keep the plugin disabled instead of dropping
  // it from the catalogue — that previously made Engine A "disappear" from the dashboard.
  const enabled = Boolean(endpoint);

  return {
    enginePluginId: "engine-sovereign-runpod",
    kind: "SOVEREIGN_INTERNAL" as const,
    name: `RunPod GPU — ${model.split("/").pop() || model}`,
    version: "1.0.0",
    enabled,
    allowedMaxClass: "SOVEREIGN" as const,
    capabilities: {
      rag: true,
      scoring: true,
      entities: true,
      patterns: true,
      localInference: true,
      reasoning: true,
    },
    config: {
      endpoint,
      model,
      fastModel: model,
      timeoutMs: parseEnvNumber(process.env.COREVIA_RUNPOD_TIMEOUT_MS, 120000, 5000, 300000),
      maxTokens: parseEnvNumber(process.env.COREVIA_RUNPOD_MAX_TOKENS, 8000, 256, 32000),
      // Hard model context window. vLLM enforces input + max_tokens <= contextWindow,
      // so dynamicMaxTokens computation in the internal engine relies on this value.
      // Default 32768 matches Qwen2.5-32B-Instruct-AWQ native context.
      contextWindow: parseEnvNumber(process.env.COREVIA_RUNPOD_CONTEXT_WINDOW, 32768, 2048, 200000),
      temperature: parseEnvNumber(process.env.COREVIA_RUNPOD_TEMPERATURE, 0.15, 0, 1),
      // RunPod is the production sovereign GPU runtime — prefer it over the local
      // Ollama/dev gateway when both endpoints are registered.
      priority: parseEnvNumber(process.env.COREVIA_RUNPOD_PRIORITY, 110, 1, 1000),
      provider: "runpod-vllm",
    },
  };
}

async function getLocalEngineWithConfig(enginePluginId: string) {
  await ensureDefaultEngineRegistry();
  const engine = await coreviaStorage.getEngine(enginePluginId);
  if (!engine) {
    return { error: "Engine not found", status: 404 as const };
  }

  if (engine.kind !== "SOVEREIGN_INTERNAL") {
    return { error: "Health and test routes are only supported for sovereign local engines", status: 400 as const };
  }

  const config = (engine.config || {}) as Record<string, unknown>;
  const endpoint = typeof config.endpoint === "string" ? config.endpoint : "";
  const model = typeof config.model === "string" ? config.model : "";

  return { engine, config, endpoint, model };
}

async function sendLocalEngineHealth(res: Response, enginePluginId: string) {
  const resolved = await getLocalEngineWithConfig(enginePluginId);
  if ("error" in resolved) {
    return res.status(resolved.status ?? 500).json({ success: false, error: resolved.error });
  }

  if (!resolved.endpoint) {
    return res.status(200).json({
      success: true,
      engine: resolved.engine.enginePluginId,
      configured: false,
      health: { ok: false, status: "unconfigured" },
    });
  }

  const health = await localInferenceAdapter.healthCheck(resolved.endpoint, 3000);
  return res.json({
    success: true,
    engine: resolved.engine.enginePluginId,
    configured: true,
    endpoint: resolved.endpoint,
    model: resolved.model,
    health,
  });
}

async function sendLocalEngineTest(req: Request, res: Response, enginePluginId: string) {
  const resolved = await getLocalEngineWithConfig(enginePluginId);
  if ("error" in resolved) {
    return res.status(resolved.status ?? 500).json({ success: false, error: resolved.error });
  }

  const requestedModel = typeof req.body?.model === "string" && req.body.model.trim() ? req.body.model.trim() : "";
  const model = requestedModel || resolved.model;
  if (!resolved.endpoint || !model) {
    return res.status(400).json({ success: false, error: "Engine endpoint or model not configured" });
  }

  const prompt = typeof req.body?.prompt === "string" && req.body.prompt.trim()
    ? req.body.prompt
    : "Return only valid JSON with keys status and message. Confirm local inference is operational.";

  const result = await localInferenceAdapter.generate({
    endpoint: resolved.endpoint,
    model,
    systemPrompt: "You are a JSON-only API. Return exactly one valid JSON object. Do not include thinking, explanations, markdown, or any text before or after the JSON object.",
    userPrompt: prompt,
    maxTokens: Number.isFinite(Number(req.body?.maxTokens)) ? Number(req.body.maxTokens) : 400,
    temperature: Number.isFinite(Number(req.body?.temperature)) ? Number(req.body.temperature) : 0.1,
    outputSchemaId: "engine-a.test.v1",
  }, 45000);

  if (!result.ok) {
    return res.status(502).json({ success: false, error: result.error || "Engine test failed", raw: result.raw || null });
  }

  return res.json({
    success: true,
    engine: resolved.engine.enginePluginId,
    endpoint: resolved.endpoint,
    model,
    parsed: parseJsonObjectFromMixedText(result.text || ""),
    text: result.text || null,
  });
}

async function ensureDefaultEngineRegistry() {
  let engines = await coreviaStorage.getAllEngines();
  const sovereignDefaults = resolveSovereignEngineDefaults();
  const alternateSovereign = resolveAlternateSovereignPlugin();

  // After a DB reset, engine plugins may be empty. Seed the default Engine A/B/C registry.
  if (!engines || engines.length === 0) {
    return seedDefaultEngineRegistry(sovereignDefaults, alternateSovereign);
  }

  const sovereign = engines.find((engine) => engine.enginePluginId === "engine-sovereign");
  const sovereignConfig = ((sovereign?.config || {}) as Record<string, unknown>);
  const repairedSovereignConfig = mergeLocalEngineConfig(sovereignConfig, sovereignDefaults);
  const envTimeoutMs = sovereignDefaults.timeoutMs;
  const dbTimeoutMs = Number.isFinite(Number(sovereignConfig.timeoutMs)) ? Number(sovereignConfig.timeoutMs) : 0;
  const timeoutDrifted = envTimeoutMs !== dbTimeoutMs && dbTimeoutMs > 0;
  const envEndpoint = sovereignDefaults.endpoint;
  const dbEndpoint = typeof sovereignConfig.endpoint === "string" ? sovereignConfig.endpoint.trim() : "";
  const endpointDrifted = !!envEndpoint && envEndpoint !== dbEndpoint;
  const missingSovereignDefaults =
    !sovereign ||
    typeof sovereignConfig.model !== "string" ||
    typeof sovereignConfig.fastModel !== "string" ||
    !dbEndpoint ||
    !((sovereign?.capabilities || {}) as Record<string, unknown>).localInference ||
    timeoutDrifted ||
    endpointDrifted;

  if (sovereign && missingSovereignDefaults) {
    await coreviaStorage.updateEngine("engine-sovereign", {
      capabilities: {
        ...((sovereign.capabilities || {}) as Record<string, boolean>),
        localInference: true,
      },
      config: repairedSovereignConfig,
    });
    logger.info("[COREVIA API] Repaired stale engine-sovereign config with local inference defaults");
    engines = await coreviaStorage.getAllEngines();
  }

  if (alternateSovereign) {
    const existingAlternate = engines.find((engine) => engine.enginePluginId === alternateSovereign.enginePluginId);
    if (!existingAlternate) {
      await coreviaStorage.registerEngine(alternateSovereign);
      logger.info(`[COREVIA API] Registered alternate sovereign plugin ${alternateSovereign.enginePluginId}`);
      engines = await coreviaStorage.getAllEngines();
    }
  }

  const runPodPlugin = resolveRunPodPlugin();
  if (runPodPlugin) {
    const existingRunPod = engines.find((engine) => engine.enginePluginId === runPodPlugin.enginePluginId);
    if (!existingRunPod) {
      await coreviaStorage.registerEngine(runPodPlugin);
      logger.info(`[COREVIA API] Registered RunPod sovereign plugin ${runPodPlugin.enginePluginId}`);
      engines = await coreviaStorage.getAllEngines();
    } else {
      const rpConfig = toRecord(existingRunPod.config);
      const rpEndpoint = typeof rpConfig.endpoint === "string" ? rpConfig.endpoint.trim() : "";
      const rpMaxTokens = Number.isFinite(Number(rpConfig.maxTokens)) ? Number(rpConfig.maxTokens) : 0;
      const rpContextWindow = Number.isFinite(Number(rpConfig.contextWindow)) ? Number(rpConfig.contextWindow) : 0;
      const envMaxTokens = runPodPlugin.config.maxTokens;
      const envContextWindow = runPodPlugin.config.contextWindow;
      if (
        rpEndpoint !== runPodPlugin.config.endpoint ||
        rpMaxTokens !== envMaxTokens ||
        rpContextWindow !== envContextWindow
      ) {
        await coreviaStorage.updateEngine(runPodPlugin.enginePluginId, {
          config: { ...rpConfig, ...runPodPlugin.config },
        });
        logger.info("[COREVIA API] Repaired RunPod engine config (endpoint/maxTokens/contextWindow drift)");
        engines = await coreviaStorage.getAllEngines();
      }
    }
  }

  const hybrid = engines.find((engine) => engine.enginePluginId === "engine-hybrid");
  const hybridConfig = ((hybrid?.config || {}) as Record<string, unknown>);
  const missingHybridDefaults =
    !hybrid ||
    typeof hybridConfig.provider !== "string" ||
    typeof hybridConfig.model !== "string" ||
    hybridConfig.redactionRequired !== true;

  if (hybrid && missingHybridDefaults) {
    await coreviaStorage.updateEngine("engine-hybrid", {
      config: {
        ...hybridConfig,
        ...DEFAULT_HYBRID_CONFIG,
      },
    });
    logger.info("[COREVIA API] Repaired stale engine-hybrid config with Claude defaults");
    engines = await coreviaStorage.getAllEngines();
  }

  const distillation = engines.find((engine) => engine.enginePluginId === "engine-distillation");
  const distillationConfig = ((distillation?.config || {}) as Record<string, unknown>);
  const missingDistillationDefaults =
    distillation &&
    (typeof distillationConfig.engineAModel !== "string" || distillationConfig.llmEnabled === undefined);

  if (missingDistillationDefaults) {
    await coreviaStorage.updateEngine("engine-distillation", {
      version: "2.0.0",
      capabilities: { distill: true, learn: true, crossCorrelation: true, trainingDataGeneration: true, llmDistillation: true },
      config: {
        ...distillationConfig,
        llmEnabled: process.env.COREVIA_DISTILLATION_LLM !== "false",
        engineAModel: String(process.env.COREVIA_ENGINE_A_MODEL || "mistral-nemo").trim(),
        autoDistill: process.env.COREVIA_AUTO_DISTILL !== "false",
      },
    });
    logger.info("[COREVIA API] Repaired stale engine-distillation config with distillation defaults");
    engines = await coreviaStorage.getAllEngines();
  }

  return engines;
}

function parseJsonObjectFromMixedText(text: string): Record<string, unknown> | null {
  const cleaned = text.replaceAll(/```json\s*/gi, "").replaceAll(/```\s*/g, "").trim();
  if (!cleaned) return null;

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return parseEmbeddedJsonObject(cleaned);
  }
}

function parseEmbeddedJsonObject(cleaned: string): Record<string, unknown> | null {
  const start = cleaned.indexOf("{");
  if (start < 0) return null;

  const state = { depth: 0, inString: false, escaping: false };

  for (let index = start; index < cleaned.length; index += 1) {
    updateJsonParseState(state, cleaned.charAt(index));
    if (state.depth === 0 && !state.inString) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, index + 1));
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : null;
      } catch {
        return null;
      }
    }
  }

  return null;
}

function updateJsonParseState(
  state: { depth: number; inString: boolean; escaping: boolean },
  char: string,
): void {
  if (state.escaping) {
    state.escaping = false;
    return;
  }
  if (char === "\\") {
    state.escaping = true;
    return;
  }
  if (char === '"') {
    state.inString = !state.inString;
    return;
  }
  if (state.inString) return;
  if (char === "{") state.depth += 1;
  if (char === "}") state.depth -= 1;
}

function extractModelName(record: Record<string, unknown>): string {
  const name = toOptionalString(record.name)?.trim();
  if (name) return name;
  const model = toOptionalString(record.model)?.trim();
  if (model) return model;
  return toOptionalString(record.id)?.trim() || "";
}

function extractModifiedAt(record: Record<string, unknown>): string | undefined {
  return toOptionalString(record.modified_at) || toOptionalString(record.modifiedAt);
}

function extractQuantizationLevel(details: Record<string, unknown>): string | undefined {
  return toOptionalString(details.quantization_level) || toOptionalString(details.quantizationLevel);
}

function extractLocalRuntimeModels(health: Awaited<ReturnType<typeof localInferenceAdapter.healthCheck>>) {
  const root = toRecord(health.details);
  const detailPayload = toRecord(root.details).constructor === Object ? toRecord(root.details) : root;
  const backend = toRecord(detailPayload.backend);
  const models = Array.isArray(backend.models) ? backend.models : Array.isArray(backend.data) ? backend.data : [];

  return models
    .map((entry) => {
      const record = toRecord(entry);
      const details = toRecord(record.details);
      const name = extractModelName(record);

      if (!name) return null;

      return {
        name,
        digest: toOptionalString(record.digest),
        size: Number.isFinite(Number(record.size)) ? Number(record.size) : undefined,
        modifiedAt: extractModifiedAt(record),
        family: toOptionalString(details.family),
        quantizationLevel: extractQuantizationLevel(details),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function sendLocalEngineModels(res: Response, enginePluginId: string) {
  const resolved = await getLocalEngineWithConfig(enginePluginId);
  if ("error" in resolved) {
    return res.status(resolved.status ?? 500).json({ success: false, error: resolved.error });
  }

  if (!resolved.endpoint) {
    return res.json({
      success: true,
      engine: resolved.engine.enginePluginId,
      configured: false,
      reachable: false,
      endpoint: "",
      model: resolved.model,
      models: [],
    });
  }

  const health = await localInferenceAdapter.healthCheck(resolved.endpoint, 3000);
  return res.json({
    success: true,
    engine: resolved.engine.enginePluginId,
    configured: true,
    reachable: health.ok,
    endpoint: resolved.endpoint,
    model: resolved.model,
    models: extractLocalRuntimeModels(health),
    health,
  });
}

// ── GET /engines ───────────────────────────────────────────────────────

router.get("/engines", async (_req: Request, res: Response) => {
  try {
    const engines = await ensureDefaultEngineRegistry();

    res.json({ success: true, engines });
  } catch (error) {
    logger.warn("[COREVIA API] Engine registry reconciliation failed:", error);
    res.status(500).json({ success: false, error: "Failed to fetch engines" });
  }
});

// ── GET /engines/routing-table ─────────────────────────────────────────

router.get("/engines/routing-table", async (_req: Request, res: Response) => {
  try {
    const table = engineRouter.getRoutingTable();
    res.json({ success: true, table });
  } catch (error) {
    sendRouteError(res, error, "Failed to fetch routing table");
  }
});

// ── GET /engines/:engineId ─────────────────────────────────────────────

router.get("/engines/:engineId", async (req: Request, res: Response) => {
  try {
    const engine = await coreviaStorage.getEngine(req.params.engineId as string);
    if (!engine) return res.status(404).json({ success: false, error: "Engine not found" });
    res.json({ success: true, engine });
  } catch (error) {
    sendRouteError(res, error, "Failed to fetch engine");
  }
});

router.get("/engines/:engineId/health", async (req: Request, res: Response) => {
  try {
    return await sendLocalEngineHealth(res, req.params.engineId as string);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to check engine health",
    });
  }
});

router.get("/engines/:engineId/models", async (req: Request, res: Response) => {
  try {
    return await sendLocalEngineModels(res, req.params.engineId as string);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch engine models",
    });
  }
});

router.get("/engines/:engineId/runtime", async (req: Request, res: Response) => {
  try {
    return await sendEngineRuntimeStatus(res, req.params.engineId as string);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch engine runtime status",
    });
  }
});

router.post("/engines/:engineId/runtime/start", strictLimiter, async (req: Request, res: Response) => {
  try {
    const engineId = req.params.engineId as string;
    const engine = await coreviaStorage.getEngine(engineId);
    if (!engine) return res.status(404).json({ success: false, error: "Engine not found" });
    if (engine.kind !== "SOVEREIGN_INTERNAL") {
      return res.status(400).json({ success: false, error: "Runtime lifecycle is only supported for sovereign local engines" });
    }

    const runtime = await withRuntimeLock(() => startManagedEngineRuntime(engineId));
    return res.json({ success: true, action: "started", engine: engineId, runtime });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to start Engine A runtime",
    });
  }
});

router.post("/engines/:engineId/runtime/stop", strictLimiter, async (req: Request, res: Response) => {
  try {
    const engineId = req.params.engineId as string;
    const engine = await coreviaStorage.getEngine(engineId);
    if (!engine) return res.status(404).json({ success: false, error: "Engine not found" });
    if (engine.kind !== "SOVEREIGN_INTERNAL") {
      return res.status(400).json({ success: false, error: "Runtime lifecycle is only supported for sovereign local engines" });
    }

    const runtime = await withRuntimeLock(() => stopManagedEngineRuntime());
    return res.json({ success: true, action: "stopped", engine: engineId, runtime });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to stop Engine A runtime",
    });
  }
});

router.post("/engines/:engineId/test", async (req: Request, res: Response) => {
  try {
    return await sendLocalEngineTest(req, res, req.params.engineId as string);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Engine test failed",
    });
  }
});

router.get("/engines/engine-a/health", async (_req: Request, res: Response) => {
  try {
    return await sendLocalEngineHealth(res, "engine-sovereign");
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to check Engine A health",
    });
  }
});

router.get("/engines/engine-a/models", async (_req: Request, res: Response) => {
  try {
    return await sendLocalEngineModels(res, "engine-sovereign");
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch Engine A models",
    });
  }
});

router.post("/engines/engine-a/test", async (req: Request, res: Response) => {
  try {
    return await sendLocalEngineTest(req, res, "engine-sovereign");
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Engine A test failed",
    });
  }
});

// ── POST /engines ──────────────────────────────────────────────────────

router.post("/engines", async (req: Request, res: Response) => {
  try {
    const { enginePluginId, kind, name, version, enabled, allowedMaxClass, capabilities, config } = req.body;
    if (!enginePluginId || !kind || !name || !version) {
      return res.status(400).json({ success: false, error: "Missing required fields: enginePluginId, kind, name, version" });
    }
    const engine = await coreviaStorage.registerEngine({ enginePluginId, kind, name, version, enabled, allowedMaxClass, capabilities, config });
    res.status(201).json({ success: true, engine });
  } catch (error: unknown) {
    if ((error as any)?.code === "23505") { // eslint-disable-line @typescript-eslint/no-explicit-any
      return res.status(409).json({ success: false, error: "Engine ID already exists" });
    }
    res.status(500).json({ success: false, error: "Failed to register engine" });
  }
});

// ── PATCH /engines/:engineId ───────────────────────────────────────────

router.patch("/engines/:engineId", async (req: Request, res: Response) => {
  try {
    const engine = await coreviaStorage.updateEngine(req.params.engineId as string, req.body);
    if (!engine) return res.status(404).json({ success: false, error: "Engine not found" });
    res.json({ success: true, engine });
  } catch (error) {
    sendRouteError(res, error, "Failed to update engine");
  }
});

// ── GET /engines/:engineId/attestations ────────────────────────────────

router.get("/engines/:engineId/attestations", async (req: Request, res: Response) => {
  try {
    const attestations = await coreviaStorage.getEngineAttestations(req.params.engineId as string);
    res.json({ success: true, attestations });
  } catch (error) {
    sendRouteError(res, error, "Failed to fetch attestations");
  }
});

// ── Redaction Gateway (Airlock) ────────────────────────────────────────

router.get("/redaction/health", async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      status: "ok",
      gateway: {
        supportedCategories: redactionGateway.getSupportedCategories(),
      },
    });
  } catch (error) {
    sendRouteError(res, error, "Failed to get redaction health");
  }
});

router.post("/redaction/sanitize", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const decisionId = typeof body.decisionId === "string" ? body.decisionId : undefined;
    const classification = typeof body.classification === "string" ? body.classification : "INTERNAL";
    const minimizationApplied = Boolean(body.minimizationApplied);

    const payload = (body.payload ?? {}) as Record<string, unknown>;
    const result = redactionGateway.redactObject(payload, minimizationApplied);

    if (decisionId) {
      await coreviaStorage.saveRedactionReceipt({
        decisionId,
        classification,
        maskingApplied: result.stats.totalRedactions > 0,
        minimizationApplied,
        outboundManifest: {
          ...result.stats,
          supportedCategories: redactionGateway.getSupportedCategories(),
        },
        tokenizationMapRef: null,
      });
    }

    res.json({
      success: true,
      sanitized: result.redacted,
      stats: result.stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to sanitize payload",
    });
  }
});

router.post("/redaction/manifest", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const minimizationApplied = Boolean(body.minimizationApplied);
    const payload = (body.payload ?? {}) as Record<string, unknown>;
    const jsonText = JSON.stringify(payload);
    const result = redactionGateway.redactText(jsonText, minimizationApplied);
    res.json({ success: true, manifest: result.outboundManifest });
  } catch (error) {
    sendRouteError(res, error, "Failed to build manifest");
  }
});

// ── Routing overrides ──────────────────────────────────────────────────

router.get("/routing-overrides", async (_req: Request, res: Response) => {
  try {
    const overrides = await coreviaStorage.getRoutingOverrides();
    res.json({ success: true, overrides });
  } catch (error) {
    sendRouteError(res, error, "Failed to fetch routing overrides");
  }
});

router.put("/routing-overrides/:overrideId", async (req: Request, res: Response) => {
  try {
    const override = await coreviaStorage.upsertRoutingOverride({
      overrideId: req.params.overrideId,
      ...req.body,
    });
    res.json({ success: true, override });
  } catch (error) {
    sendRouteError(res, error, "Failed to save routing override");
  }
});

// ── Distillation (Engine C) Status & Controls ──────────────────────────

let distillationEngineInstance: InstanceType<typeof import("../intelligence/distillation").DistillationEngine> | null = null;

async function getDistillationEngine() {
  if (!distillationEngineInstance) {
    const { DistillationEngine } = await import("../intelligence/distillation");
    distillationEngineInstance = new DistillationEngine(coreviaStorage);
  }
  return distillationEngineInstance;
}

router.get("/engines/distillation/status", async (_req: Request, res: Response) => {
  try {
    const engine = await getDistillationEngine();
    const status = engine.getStatus();

    const learningStats = await coreviaStorage.getLearningStats();

    res.json({
      success: true,
      engine: {
        ...status,
        name: "Distillation Engine",
        kind: "DISTILLATION",
        version: "2.0.0",
      },
      learning: learningStats,
    });
  } catch (error) {
    logger.error("[COREVIA API] Distillation status error:", error);
    res.status(500).json({ success: false, error: "Failed to get distillation status" });
  }
});

router.post("/engines/distillation/correlate", async (_req: Request, res: Response) => {
  try {
    const engine = await getDistillationEngine();

    const allDecisions = await coreviaStorage.listDecisions();
    const approvedDecisions = allDecisions.filter(
      (d) => d.status === "memory" || d.status === "action_execution" || d.status === "completed"
    );

    if (approvedDecisions.length < 2) {
      return res.json({ success: true, correlations: [], message: "Need at least 2 approved decisions for correlation" });
    }

    const fullDecisions = await Promise.all(
      approvedDecisions.slice(0, 20).map(async (d: { id: string; serviceId: string; routeKey: string }) => {
        const full = await coreviaStorage.getFullDecisionWithLayers(d.id);
        const cls = full.classification as Record<string, unknown> | null;
        const adv = full.advisory as Record<string, unknown> | null;
        return {
          decisionId: d.id,
          input: { serviceId: d.serviceId, routeKey: d.routeKey },
          classification: cls ? { classificationLevel: cls.classificationLevel, sector: cls.sector, riskLevel: cls.riskLevel, constraints: cls.constraints } : undefined,
          advisory: adv ? { options: adv.options || [], risks: adv.risks || [], evidence: adv.evidence || [], overallConfidence: adv.overallConfidence || 0 } : { options: [], risks: [], evidence: [], overallConfidence: 0 },
          validation: { status: "approved" },
        } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      })
    );

    const result = await engine.correlateDecisions(fullDecisions);

    res.json({
      success: true,
      correlations: result.correlations,
      llmUsed: result.llmUsed,
      decisionsAnalyzed: fullDecisions.length,
    });
  } catch (error) {
    logger.error("[COREVIA API] Correlation error:", error);
    res.status(500).json({ success: false, error: "Correlation failed" });
  }
});

export default router;
