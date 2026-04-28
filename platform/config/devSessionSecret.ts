import { createHash } from "node:crypto";
import os from "node:os";

export function resolveDevelopmentSessionSecret(env: Record<string, string | undefined> = process.env): string {
  if (env.SESSION_SECRET && env.SESSION_SECRET.trim() !== "") {
    return env.SESSION_SECRET;
  }

  const seed = [os.hostname(), process.cwd(), env.USER ?? env.LOGNAME ?? "corevia-dev"].join(":");
  return createHash("sha256").update(seed).digest("hex");
}