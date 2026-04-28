import { spawn } from "node:child_process";

const child = spawn("node", ["--import", "tsx", "apps/worker/index.ts"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || "development",
    ENABLE_REDIS: process.env.ENABLE_REDIS || "true",
    REDIS_HOST: process.env.REDIS_HOST || "127.0.0.1",
    REDIS_PORT: process.env.REDIS_PORT || "6379",
    WORKER_PORT: process.env.WORKER_PORT || "5002",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});