#!/usr/bin/env node
// COREVIA Engine A (RunPod) end-to-end probe.
// Reports proxy reachability, gateway health, and the api's view of the engine.
// Usage:
//   npm run engine:probe                 # uses RUNPOD_LLM_ENDPOINT from .env.docker
//   RUNPOD_LLM_ENDPOINT=https://xxx-8000.proxy.runpod.net/v1 RUNPOD_LLM_API_KEY=sk-... npm run engine:probe
//   npm run engine:probe -- --endpoint https://xxx-8000.proxy.runpod.net/v1 --apiKey sk-...

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function loadEnvFromFile(p) {
  if (!existsSync(p)) return {};
  const text = readFileSync(p, "utf8");
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(k in out)) out[k] = v;
  }
  return out;
}

const repoRoot = resolve(new URL("../..", import.meta.url).pathname);
const dockerEnv = loadEnvFromFile(resolve(repoRoot, ".env.docker"));

const endpoint =
  getArg("endpoint") ||
  process.env.RUNPOD_LLM_ENDPOINT ||
  dockerEnv.RUNPOD_LLM_ENDPOINT ||
  "";
const apiKey =
  getArg("apiKey") ||
  process.env.RUNPOD_LLM_API_KEY ||
  dockerEnv.RUNPOD_LLM_API_KEY ||
  "";
const model =
  getArg("model") ||
  process.env.RUNPOD_LLM_MODEL ||
  dockerEnv.RUNPOD_LLM_MODEL ||
  "";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};
const ok = (s) => `${C.green}✓${C.reset} ${s}`;
const fail = (s) => `${C.red}✗${C.reset} ${s}`;
const warn = (s) => `${C.yellow}!${C.reset} ${s}`;
const info = (s) => `${C.cyan}·${C.reset} ${s}`;

function header(t) {
  console.log(`\n${C.bold}${t}${C.reset}`);
}

async function timedFetch(url, init = {}, timeoutMs = 15_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    return { res, ms: Date.now() - start };
  } catch (err) {
    return { err, ms: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

async function probeProxy() {
  header("1. RunPod proxy (vLLM upstream)");
  if (!endpoint) {
    console.log(fail("RUNPOD_LLM_ENDPOINT is empty. Set it in .env.docker."));
    return false;
  }
  console.log(info(`endpoint: ${endpoint}`));
  console.log(info(`model:    ${model || "(not set)"}`));

  const base = endpoint.replace(/\/+$/, "");
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

  // /v1/models
  const m = await timedFetch(`${base}/models`, { headers });
  if (m.err) {
    console.log(fail(`GET ${base}/models — ${m.err.name}: ${m.err.message} (${m.ms}ms)`));
    return false;
  }
  if (m.res.status === 200) {
    const body = await m.res.text();
    let parsed = null;
    try { parsed = JSON.parse(body); } catch {}
    const ids = (parsed?.data || []).map((d) => d.id || d.model || "(unknown)");
    console.log(ok(`GET /v1/models → 200 (${m.ms}ms)`));
    if (ids.length) {
      console.log(info(`available models: ${ids.join(", ")}`));
      if (model && !ids.includes(model)) {
        console.log(warn(`configured RUNPOD_LLM_MODEL='${model}' is NOT in the served list`));
      }
    } else {
      console.log(warn("response had no 'data' array; raw length=" + body.length));
    }
  } else {
    const txt = await m.res.text().catch(() => "");
    console.log(fail(`GET /v1/models → HTTP ${m.res.status} (${m.ms}ms) ${txt.slice(0, 200)}`));
    if (m.res.status === 404) {
      console.log(warn(`The proxy host is reachable but no listener is mapped to port 8000.`));
      console.log(warn(`Most common cause: the pod was recreated and got a NEW pod ID.`));
      console.log(warn(`Open RunPod dashboard → Pod → Connect → copy the new "https://<id>-8000.proxy.runpod.net" URL.`));
      console.log(warn(`Then: edit .env.docker → RUNPOD_LLM_ENDPOINT=<new>/v1 and run "docker compose restart engine-a-runpod-gateway api".`));
    } else if (m.res.status === 401 || m.res.status === 403) {
      console.log(warn(`Auth rejected — check RUNPOD_LLM_API_KEY.`));
    }
    return false;
  }

  // quick chat-completion smoke test if model is set
  if (model) {
    const c = await timedFetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: 'Reply with the single word "ok".' }],
        max_tokens: 8,
        temperature: 0,
      }),
    }, 60_000);
    if (c.err) {
      console.log(fail(`POST /v1/chat/completions — ${c.err.message} (${c.ms}ms)`));
    } else if (c.res.status === 200) {
      const j = await c.res.json().catch(() => ({}));
      const reply = j?.choices?.[0]?.message?.content?.trim()?.slice(0, 60) || "(empty)";
      console.log(ok(`POST /v1/chat/completions → 200 (${c.ms}ms) reply="${reply}"`));
    } else {
      const txt = await c.res.text().catch(() => "");
      console.log(fail(`POST /v1/chat/completions → HTTP ${c.res.status} (${c.ms}ms) ${txt.slice(0, 200)}`));
    }
  }
  return true;
}

async function probeGateway() {
  header("2. engine-a-runpod-gateway (in-cluster)");
  // Best-effort: only works when run from a host that can reach the docker bridge.
  // From the host, the gateway container exposes ${RUNPOD_LLM_GATEWAY_PORT:-8082}.
  const port = process.env.RUNPOD_LLM_GATEWAY_PORT || dockerEnv.RUNPOD_LLM_GATEWAY_PORT || "8082";
  const url = `http://127.0.0.1:${port}/internal-llm/health`;
  console.log(info(`probing ${url}`));
  const r = await timedFetch(url, {}, 5_000);
  if (r.err) {
    console.log(warn(`gateway not reachable on host port ${port} (${r.err.message}). This is normal if the gateway only binds inside the docker network.`));
    return;
  }
  const body = await r.res.text();
  if (r.res.status === 200) {
    console.log(ok(`gateway HTTP 200: ${body.slice(0, 200)}`));
  } else {
    console.log(fail(`gateway HTTP ${r.res.status}: ${body.slice(0, 200)}`));
  }
}

async function probeApi() {
  header("3. COREVIA api engines/routing-table (requires session cookie)");
  const cookie = process.env.COREVIA_SESSION_COOKIE;
  if (!cookie) {
    console.log(info("set COREVIA_SESSION_COOKIE='corevia.sid=...' to also test the api view; skipping."));
    return;
  }
  const r = await timedFetch("http://127.0.0.1:5001/api/corevia/engines/routing-table", {
    headers: { Cookie: cookie },
  });
  if (r.err) {
    console.log(fail(`api unreachable: ${r.err.message}`));
    return;
  }
  const body = await r.res.text();
  if (r.res.status !== 200) {
    console.log(fail(`api HTTP ${r.res.status}: ${body.slice(0, 200)}`));
    return;
  }
  let parsed = null;
  try { parsed = JSON.parse(body); } catch {}
  const engines = parsed?.engines || parsed?.data || parsed || [];
  if (Array.isArray(engines)) {
    for (const e of engines) {
      const id = e.enginePluginId || e.id || "?";
      const enabled = e.enabled === false ? "disabled" : "enabled";
      const ep = e.config?.endpoint || "";
      const prio = e.config?.priority ?? "?";
      console.log(info(`${id} [${enabled}] priority=${prio} endpoint=${ep}`));
    }
  } else {
    console.log(info(JSON.stringify(parsed).slice(0, 400)));
  }
}

(async () => {
  console.log(`${C.bold}COREVIA Engine A probe${C.reset}  ${C.dim}(${new Date().toISOString()})${C.reset}`);
  const proxyOk = await probeProxy();
  await probeGateway();
  await probeApi();
  console.log("");
  if (!proxyOk) {
    console.log(fail("RunPod proxy is the blocker. Fix the endpoint/auth and re-run."));
    process.exit(1);
  }
  console.log(ok("Engine A upstream is healthy. If the api still falls back, restart the gateway: docker compose restart engine-a-runpod-gateway api"));
})();
