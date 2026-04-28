export type LocalInferenceHealth = {
  ok: boolean;
  status: "ok" | "unreachable" | "error";
  details?: Record<string, unknown>;
};

export type LocalInferenceGenerateParams = {
  endpoint: string;
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  outputSchemaId?: string;
};

export type LocalInferenceGenerateResult = {
  ok: boolean;
  text?: string;
  error?: string;
  raw?: unknown;
};

function withTimeout(ms: number, externalSignal?: AbortSignal): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }
  const timeout = setTimeout(() => controller.abort(new Error(`Local inference timed out after ${ms}ms`)), ms);
  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timeout);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onExternalAbort);
      }
    },
  };
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replaceAll(/\/+$/g, "");
}

export class LocalInferenceAdapter {
  async healthCheck(endpoint: string, timeoutMs = 2000, externalSignal?: AbortSignal): Promise<LocalInferenceHealth> {
    const base = normalizeEndpoint(endpoint);
    // RunPod-backed gateways can return transient 503 / network errors during cold-starts.
    // Retry up to 3 times with short backoff so a warming worker doesn't force fallback to Engine B.
    const maxAttempts = 3;
    const perAttemptTimeout = Math.max(2000, Math.floor(timeoutMs / maxAttempts));
    let lastDetails: Record<string, unknown> = {};
    let lastStatus: "unreachable" | "error" = "unreachable";
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { signal, cancel } = withTimeout(perAttemptTimeout, externalSignal);
      try {
        const res = await fetch(`${base}/internal-llm/health`, { method: "GET", signal });
        cancel();
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          return { ok: true, status: "ok", details: json as Record<string, unknown> };
        }
        lastStatus = "error";
        lastDetails = { httpStatus: res.status, attempt };
      } catch (err) {
        cancel();
        lastStatus = "unreachable";
        lastDetails = { error: err instanceof Error ? err.message : String(err), attempt };
      }
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
    return { ok: false, status: lastStatus, details: lastDetails };
  }

  async generate(params: LocalInferenceGenerateParams, timeoutMs = 20000, externalSignal?: AbortSignal): Promise<LocalInferenceGenerateResult> {
    const base = normalizeEndpoint(params.endpoint);
    const { signal, cancel } = withTimeout(timeoutMs, externalSignal);

    try {
      const payload = {
        model: params.model,
        maxTokens: params.maxTokens,
        temperature: params.temperature,
        outputSchemaId: params.outputSchemaId,
        systemPrompt: params.systemPrompt,
        prompt: params.userPrompt,
        responseFormat: "json",
      };

      const res = await fetch(`${base}/internal-llm/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });
      cancel();

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const suffix = text ? `: ${text}` : "";
        return { ok: false, error: `Local inference HTTP ${res.status}${suffix}` };
      }

      const json = await res.json().catch(() => null);
      if (!json || typeof json !== "object") {
        return { ok: false, error: "Local inference returned non-JSON response", raw: json };
      }

      const jsonRecord = json as Record<string, unknown>;
      const maybeText = jsonRecord.text ?? jsonRecord.content ?? jsonRecord.output;
      const text = typeof maybeText === "string" ? maybeText : JSON.stringify(json);
      return { ok: true, text, raw: json };
    } catch (err) {
      cancel();
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const localInferenceAdapter = new LocalInferenceAdapter();
