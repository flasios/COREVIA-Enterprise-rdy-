import express from "express";

type LocalProvider = "ollama" | "openai-compatible" | "runpod-native";

interface GenerateRequestBody {
  model?: unknown;
  systemPrompt?: unknown;
  prompt?: unknown;
  maxTokens?: unknown;
  temperature?: unknown;
  outputSchemaId?: unknown;
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: process.env.LOCAL_LLM_PAYLOAD_LIMIT || "2mb" }));

function trimTrailingSlash(value: string): string {
  return value.replaceAll(/\/+$/g, "");
}

function parseNumber(value: string | undefined, fallback: number, min?: number, max?: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    const withMinBound = min === undefined ? parsed : Math.max(min, parsed);
    return max === undefined ? withMinBound : Math.min(max, withMinBound);
  }

  return fallback;
}

function resolveProvider(): LocalProvider {
  const raw = String(process.env.LOCAL_LLM_PROVIDER || "ollama").trim().toLowerCase();
  if (raw === "openai-compatible") return "openai-compatible";
  if (raw === "runpod-native" || raw === "runpod") return "runpod-native";
  return "ollama";
}

function resolveBaseUrl(provider: LocalProvider): string {
  const configured = String(process.env.LOCAL_LLM_BASE_URL || "").trim();
  if (configured) return trimTrailingSlash(configured);
  if (provider === "openai-compatible") return "http://host.docker.internal:8000/v1";
  if (provider === "runpod-native") return "https://api.runpod.ai/v2";
  return "http://local-llm:11434";
}

function resolveModelsPath(baseUrl: string): string[] {
  if (baseUrl.endsWith("/v1")) {
    return [`${baseUrl}/models`];
  }
  return [`${baseUrl}/v1/models`, `${baseUrl}/models`];
}

function buildPrompt(systemPrompt: string | undefined, userPrompt: string, outputSchemaId?: string): string {
  const parts = [
    systemPrompt?.trim(),
    outputSchemaId ? `Output schema: ${outputSchemaId}` : undefined,
    userPrompt.trim(),
  ].filter((value): value is string => Boolean(value));

  return parts.join("\n\n");
}

function getRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const apiKey = String(process.env.LOCAL_LLM_API_KEY || "").trim();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function unloadOllamaModel(baseUrl: string, model: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: getRequestHeaders(),
      body: JSON.stringify({
        model,
        prompt: "",
        stream: false,
        keep_alive: 0,
      }),
    });
  } catch {
    // Best-effort cleanup only.
  }
}

async function checkHealth(provider: LocalProvider, baseUrl: string, timeoutMs: number): Promise<{ ok: boolean; status: string; details: Record<string, unknown> }> {
  try {
    if (provider === "ollama") {
      const response = await fetchJsonWithTimeout(`${baseUrl}/api/tags`, { method: "GET" }, timeoutMs);
      if (!response.ok) {
        return { ok: false, status: "error", details: { httpStatus: response.status, provider } };
      }

      const payload = await response.json().catch(() => ({}));
      return { ok: true, status: "ok", details: { provider, backend: payload } };
    }

    if (provider === "runpod-native") {
      // baseUrl already includes /v2/{endpointId} (or just /v2 if user didn't append the id).
      const url = baseUrl.endsWith("/health") ? baseUrl : `${baseUrl}/health`;
      const response = await fetchJsonWithTimeout(url, { method: "GET", headers: getRequestHeaders() }, timeoutMs);
      if (!response.ok) {
        return { ok: false, status: "error", details: { httpStatus: response.status, provider } };
      }
      const payload = await response.json().catch(() => ({}));
      return { ok: true, status: "ok", details: { provider, backend: payload } };
    }

    for (const url of resolveModelsPath(baseUrl)) {
      const response = await fetchJsonWithTimeout(url, { method: "GET", headers: getRequestHeaders() }, timeoutMs);
      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        return { ok: true, status: "ok", details: { provider, backend: payload } };
      }
    }

    return { ok: false, status: "error", details: { provider, message: "No compatible models endpoint responded" } };
  } catch (error) {
    return {
      ok: false,
      status: "unreachable",
      details: { provider, error: error instanceof Error ? error.message : String(error) },
    };
  }
}

async function generateWithOllama(baseUrl: string, body: Required<Pick<GenerateRequestBody, "model">> & { prompt: string; systemPrompt?: string; maxTokens: number; temperature: number; outputSchemaId?: string }, timeoutMs: number) {
  try {
    const response = await fetchJsonWithTimeout(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: getRequestHeaders(),
      body: JSON.stringify({
        model: body.model,
        prompt: buildPrompt(typeof body.systemPrompt === "string" ? body.systemPrompt : undefined, body.prompt, typeof body.outputSchemaId === "string" ? body.outputSchemaId : undefined),
        stream: false,
        format: "json",
        keep_alive: 0,
        options: {
          temperature: body.temperature,
          num_predict: body.maxTokens,
        },
      }),
    }, timeoutMs);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const details = text ? `: ${text}` : "";
      throw new Error(`Ollama generate failed (${response.status})${details}`);
    }

    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    const text = typeof payload?.response === "string"
      ? payload.response
      : JSON.stringify(payload);

    return { text, raw: payload };
  } catch (error) {
    await unloadOllamaModel(baseUrl, String(body.model));
    throw error;
  }
}

function extractOpenAIContent(payload: Record<string, unknown> | null): string {
  const choice = Array.isArray(payload?.choices) ? payload?.choices[0] as Record<string, unknown> | undefined : undefined;
  const message = choice?.message as Record<string, unknown> | undefined;
  const content = message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof (part as Record<string, unknown>)?.text === "string" ? String((part as Record<string, unknown>).text) : ""))
      .join("");
  }

  return JSON.stringify(payload);
}

async function generateWithOpenAICompatible(baseUrl: string, body: Required<Pick<GenerateRequestBody, "model">> & { prompt: string; systemPrompt?: string; maxTokens: number; temperature: number; outputSchemaId?: string }, timeoutMs: number) {
  const url = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
  const response = await fetchJsonWithTimeout(url, {
    method: "POST",
    headers: getRequestHeaders(),
    body: JSON.stringify({
      model: body.model,
      messages: [
        ...(typeof body.systemPrompt === "string" && body.systemPrompt.trim().length > 0
          ? [{ role: "system", content: body.systemPrompt.trim() }]
          : []),
        { role: "user", content: buildPrompt(undefined, body.prompt, typeof body.outputSchemaId === "string" ? body.outputSchemaId : undefined) },
      ],
      temperature: body.temperature,
      max_tokens: body.maxTokens,
      response_format: { type: "json_object" },
    }),
  }, timeoutMs);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const details = text ? `: ${text}` : "";
    throw new Error(`OpenAI-compatible generate failed (${response.status})${details}`);
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  return { text: extractOpenAIContent(payload), raw: payload };
}

function extractRunpodNativeContent(payload: Record<string, unknown> | null): string {
  // Native /runsync response: { output: [ { choices: [ { tokens: ["..."] } ] } ] }
  // Be liberal with shapes seen across worker images.
  const output = (payload?.output as unknown);
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0] as Record<string, unknown> | undefined;
    const choices = first?.choices as unknown;
    if (Array.isArray(choices) && choices.length > 0) {
      const choice = choices[0] as Record<string, unknown>;
      const tokens = choice?.tokens;
      if (Array.isArray(tokens)) return tokens.map((t) => String(t)).join("");
      const text = choice?.text;
      if (typeof text === "string") return text;
      const message = choice?.message as Record<string, unknown> | undefined;
      const content = message?.content;
      if (typeof content === "string") return content;
    }
    if (typeof first?.text === "string") return first.text as string;
  }
  if (typeof payload?.output === "string") return payload.output as string;
  return JSON.stringify(payload);
}

async function generateWithRunpodNative(
  baseUrl: string,
  body: Required<Pick<GenerateRequestBody, "model">> & { prompt: string; systemPrompt?: string; maxTokens: number; temperature: number; outputSchemaId?: string },
  timeoutMs: number,
) {
  const messages = [
    ...(typeof body.systemPrompt === "string" && body.systemPrompt.trim().length > 0
      ? [{ role: "system", content: body.systemPrompt.trim() }]
      : []),
    { role: "user", content: buildPrompt(undefined, body.prompt, typeof body.outputSchemaId === "string" ? body.outputSchemaId : undefined) },
  ];

  // RunPod vLLM worker uses sampling_params for generation controls; top-level max_tokens
  // is ignored and the worker default (100) is used instead. Pass both for compatibility.
  const samplingParams = {
    max_tokens: body.maxTokens,
    temperature: body.temperature,
  };
  const requestBody = JSON.stringify({
    input: {
      messages,
      sampling_params: samplingParams,
      max_tokens: body.maxTokens,
      temperature: body.temperature,
      response_format: { type: "json_object" },
    },
  });

  // Submit asynchronously so cold-starts (which can exceed RunPod's runsync wait window) don't fail.
  const submitRes = await fetchJsonWithTimeout(`${baseUrl}/run`, {
    method: "POST",
    headers: getRequestHeaders(),
    body: requestBody,
  }, Math.min(30000, timeoutMs));

  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => "");
    throw new Error(`RunPod native submit failed (${submitRes.status})${text ? `: ${text}` : ""}`);
  }

  const submitPayload = await submitRes.json().catch(() => null) as Record<string, unknown> | null;
  const jobId = submitPayload && typeof submitPayload.id === "string" ? submitPayload.id : "";
  if (!jobId) {
    throw new Error(`RunPod native submit returned no job id: ${JSON.stringify(submitPayload)}`);
  }

  // Poll /status/{jobId} until COMPLETED, FAILED, CANCELLED, or TIMED_OUT.
  const start = Date.now();
  const pollIntervalMs = 1500;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - start > timeoutMs) {
      // Best-effort cancel so we don't burn credit on an abandoned job.
      try {
        await fetchJsonWithTimeout(`${baseUrl}/cancel/${jobId}`, { method: "POST", headers: getRequestHeaders() }, 5000);
      } catch { /* ignore */ }
      throw new Error(`RunPod native job ${jobId} timed out after ${timeoutMs}ms`);
    }

    const statusRes = await fetchJsonWithTimeout(`${baseUrl}/status/${jobId}`, {
      method: "GET",
      headers: getRequestHeaders(),
    }, 30000);

    if (!statusRes.ok) {
      const text = await statusRes.text().catch(() => "");
      throw new Error(`RunPod native status poll failed (${statusRes.status})${text ? `: ${text}` : ""}`);
    }

    const statusPayload = await statusRes.json().catch(() => null) as Record<string, unknown> | null;
    const status = statusPayload && typeof statusPayload.status === "string" ? statusPayload.status : "";

    if (status === "COMPLETED") {
      return { text: extractRunpodNativeContent(statusPayload), raw: statusPayload };
    }
    if (status === "FAILED" || status === "CANCELLED" || status === "TIMED_OUT") {
      const errMsg = statusPayload && (statusPayload as Record<string, unknown>).error;
      throw new Error(`RunPod native job ${jobId} status=${status}${errMsg ? ` error=${String(errMsg)}` : ""}`);
    }

    // Still IN_QUEUE / IN_PROGRESS — wait and poll again.
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

app.get("/internal-llm/health", async (_req, res) => {
  const provider = resolveProvider();
  const baseUrl = resolveBaseUrl(provider);
  const timeoutMs = parseNumber(process.env.LOCAL_LLM_HEALTH_TIMEOUT_MS, 3000, 250, 120000);
  const health = await checkHealth(provider, baseUrl, timeoutMs);

  res.status(health.ok ? 200 : 503).json({
    ok: health.ok,
    status: health.status,
    provider,
    baseUrl,
    details: health.details,
  });
});

app.get("/internal-llm/live", (_req, res) => {
  const provider = resolveProvider();
  res.json({
    ok: true,
    status: "live",
    provider,
    baseUrl: resolveBaseUrl(provider),
  });
});

app.get("/internal-llm/ready", async (_req, res) => {
  const provider = resolveProvider();
  const baseUrl = resolveBaseUrl(provider);
  const timeoutMs = parseNumber(process.env.LOCAL_LLM_HEALTH_TIMEOUT_MS, 3000, 250, 120000);
  const health = await checkHealth(provider, baseUrl, timeoutMs);

  res.status(health.ok ? 200 : 503).json({
    ok: health.ok,
    status: health.status,
    provider,
    baseUrl,
    details: health.details,
  });
});

app.post("/internal-llm/generate", async (req, res) => {
  const provider = resolveProvider();
  const baseUrl = resolveBaseUrl(provider);
  const timeoutMs = parseNumber(process.env.LOCAL_LLM_GENERATE_TIMEOUT_MS, 300000, 1000, 600000);
  const body = (req.body || {}) as GenerateRequestBody;
  const model = typeof body.model === "string" && body.model.trim().length > 0
    ? body.model.trim()
    : String(process.env.LOCAL_LLM_DEFAULT_MODEL || "").trim();
  const prompt = typeof body.prompt === "string" ? body.prompt : "";

  if (!model || !prompt.trim()) {
    return res.status(400).json({
      error: "Both model and prompt are required",
    });
  }

  try {
    const payload = {
      model,
      prompt,
      systemPrompt: typeof body.systemPrompt === "string" ? body.systemPrompt : undefined,
      maxTokens: Number.isFinite(Number(body.maxTokens)) ? Math.max(32, Math.floor(Number(body.maxTokens))) : 800,
      temperature: Number.isFinite(Number(body.temperature)) ? Math.max(0, Math.min(1, Number(body.temperature))) : 0.1,
      outputSchemaId: typeof body.outputSchemaId === "string" ? body.outputSchemaId : undefined,
    };

    const result = provider === "openai-compatible"
      ? await generateWithOpenAICompatible(baseUrl, payload, timeoutMs)
      : provider === "runpod-native"
        ? await generateWithRunpodNative(baseUrl, payload, timeoutMs)
        : await generateWithOllama(baseUrl, payload, timeoutMs);

    return res.json({
      text: result.text,
      provider,
      model,
      raw: result.raw,
    });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : String(error),
      provider,
      model,
    });
  }
});

const port = parseNumber(process.env.PORT, 8080, 1, 65535);
const host = process.env.HOST || "0.0.0.0";

app.listen(port, host, () => {
  console.log(`[ai-service] listening on http://${host}:${port}`);
  console.log(`[ai-service] provider=${resolveProvider()} baseUrl=${resolveBaseUrl(resolveProvider())}`);
});
