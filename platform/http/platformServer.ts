import type { Express } from "express";
import fs from "node:fs";
import * as http from "node:http";
import { createServer as createHttpsServer, type Server as HttpsServer } from "node:https";

export type PlatformServer = http.Server | HttpsServer;

interface TlsConfig {
  enabled: boolean;
  keyPath?: string;
  certPath?: string;
  caPath?: string;
}

function resolveTlsConfig(env: NodeJS.ProcessEnv): TlsConfig {
  const keyPath = env.TLS_KEY_PATH?.trim();
  const certPath = env.TLS_CERT_PATH?.trim();
  const caPath = env.TLS_CA_PATH?.trim();
  const enabled = env.TLS_ENABLED === "true" || Boolean(keyPath && certPath);
  return { enabled, keyPath, certPath, caPath };
}

function isLocalDockerProfile(env: NodeJS.ProcessEnv): boolean {
  return (env.COREVIA_RUNTIME_PROFILE || "").toLowerCase() === "local-docker";
}

function isNonProductionRuntime(env: NodeJS.ProcessEnv): boolean {
  return (env.NODE_ENV || "development").toLowerCase() !== "production";
}

export function getPlatformProtocol(env: NodeJS.ProcessEnv = process.env): "http" | "https" {
  return resolveTlsConfig(env).enabled ? "https" : "http";
}

export function createPlatformServer(app: Express, env: NodeJS.ProcessEnv = process.env): PlatformServer {
  const tls = resolveTlsConfig(env);
  if (!tls.enabled) {
    if (isLocalDockerProfile(env) || isNonProductionRuntime(env)) {
      // nosemgrep: local non-production runtime intentionally permits HTTP when TLS material is absent
      return new http.Server(app);
    }

    throw new Error("TLS is required. Configure TLS_KEY_PATH and TLS_CERT_PATH before starting the platform server.");
  }

  if (!tls.keyPath || !tls.certPath) {
    throw new Error("TLS is enabled but TLS_KEY_PATH or TLS_CERT_PATH is missing");
  }

  return createHttpsServer({
    key: fs.readFileSync(tls.keyPath),
    cert: fs.readFileSync(tls.certPath),
    ...(tls.caPath ? { ca: fs.readFileSync(tls.caPath) } : {}),
  }, app);
}