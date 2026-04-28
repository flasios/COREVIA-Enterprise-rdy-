import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const entry = "apps/api/index.ts";
const bridgeEntry = "infrastructure/scripts/lmstudio-bridge.ts";
const dockerEngineAEndpoint = "http://127.0.0.1:8080";
const defaultEngineAEndpoint = "http://127.0.0.1:1235";

async function canReach(url) {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealthyEndpoint(url, attempts = 20, delayMs = 500) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await canReach(url)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return false;
}

function stopStandaloneBridgeProcesses() {
  const result = spawnSync("pkill", ["-f", bridgeEntry], {
    stdio: "ignore",
  });

  if (result.status === 0) {
    console.log("[run-api-dev] Stopped stale standalone Engine A bridge processes.");
  }
}

if ((process.env.NODE_ENV || "development") === "development") {
  rmSync(path.resolve("node_modules", ".vite"), { recursive: true, force: true });
}

const resolvedDockerEngineA = await canReach(`${dockerEngineAEndpoint}/internal-llm/health`)
  ? dockerEngineAEndpoint
  : null;

const engineAEndpoint = process.env.COREVIA_ENGINE_A_ENDPOINT || resolvedDockerEngineA || defaultEngineAEndpoint;
const shouldAutoStartBridge =
  (process.env.NODE_ENV || "development") === "development"
  && !resolvedDockerEngineA
  && (!process.env.COREVIA_ENGINE_A_ENDPOINT || process.env.COREVIA_ENGINE_A_ENDPOINT === defaultEngineAEndpoint)
  && !(await canReach(`${defaultEngineAEndpoint}/internal-llm/health`));

if (engineAEndpoint === dockerEngineAEndpoint) {
  stopStandaloneBridgeProcesses();
}

let bridgeChild = null;

if (shouldAutoStartBridge) {
  console.log(`[run-api-dev] Engine A Docker gateway unavailable. Starting local bridge at ${defaultEngineAEndpoint}.`);
  bridgeChild = spawn("node", ["--import", "tsx", bridgeEntry], {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "development",
      PORT: process.env.COREVIA_ENGINE_A_BRIDGE_PORT || "1235",
      HOST: process.env.COREVIA_ENGINE_A_BRIDGE_HOST || "127.0.0.1",
    },
  });

  const bridgeReady = await waitForHealthyEndpoint(`${defaultEngineAEndpoint}/internal-llm/health`, 30, 500);
  if (!bridgeReady) {
    console.error(`[run-api-dev] Engine A bridge did not become healthy at ${defaultEngineAEndpoint}.`);
    if (bridgeChild && !bridgeChild.killed) {
      bridgeChild.kill("SIGTERM");
    }
    process.exit(1);
  }
}

console.log(`[run-api-dev] Using Engine A endpoint: ${engineAEndpoint}`);

const child = spawn("node", ["--import", "tsx", entry], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || "development",
    ENABLE_REDIS: process.env.ENABLE_REDIS || "true",
    REDIS_HOST: process.env.REDIS_HOST || "127.0.0.1",
    REDIS_PORT: process.env.REDIS_PORT || "6379",
    COREVIA_ENGINE_A_ENDPOINT: engineAEndpoint,
  },
});

const cleanupBridge = () => {
  if (bridgeChild && !bridgeChild.killed) {
    console.log("[run-api-dev] Stopping auto-started Engine A bridge.");
    bridgeChild.kill("SIGTERM");
  }
};

process.on("exit", cleanupBridge);
process.on("SIGINT", cleanupBridge);
process.on("SIGTERM", cleanupBridge);

child.on("exit", (code, signal) => {
  cleanupBridge();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});