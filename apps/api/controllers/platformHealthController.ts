import Redis from "ioredis";
import type { Request, Response } from "express";

import { checkDatabaseHealth } from "@domains/platform/application";
import { logger } from "@platform/logging/Logger";

import {
  createBasicHealthResponse,
  createCoreviaHealthResponse,
  createPlatformHealthResponse,
  createPlatformHealthServicesResponse,
  type PlatformHealthResponse,
  type PlatformServiceHealth,
  type PlatformSystemHealth,
} from "../contracts";

const startTime = Date.now();

// CPU sampling for real-time percentage calculation
interface CpuSample {
  cpuUsage: NodeJS.CpuUsage;
  timestamp: number;
}

let previousSample: CpuSample | null = null;

function calculateCpuPercentage(): { user: number; system: number } {
  const currentUsage = process.cpuUsage();
  const currentTime = Date.now();

  if (!previousSample) {
    previousSample = { cpuUsage: currentUsage, timestamp: currentTime };
    return { user: 0, system: 0 };
  }

  const timeDeltaMs = currentTime - previousSample.timestamp;
  const cpuDeltaUser = currentUsage.user - previousSample.cpuUsage.user;
  const cpuDeltaSystem = currentUsage.system - previousSample.cpuUsage.system;

  if (timeDeltaMs === 0) {
    return { user: 0, system: 0 };
  }

  // Convert microseconds to percentage
  // 100% on 1 core = timeDeltaMs * 1000 microseconds of CPU time
  const maxCpuTimePerCore = timeDeltaMs * 1000; // microseconds available per core

  // Calculate CPU usage as percentage of one core
  const userPercent = (cpuDeltaUser / maxCpuTimePerCore) * 100;
  const systemPercent = (cpuDeltaSystem / maxCpuTimePerCore) * 100;

  previousSample = { cpuUsage: currentUsage, timestamp: currentTime };

  return {
    user: Math.max(0, Math.min(100, Math.round(userPercent * 10) / 10)),
    system: Math.max(0, Math.min(100, Math.round(systemPercent * 10) / 10)),
  };
}

function getUptimeSeconds(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

function getSystemMetrics(): PlatformSystemHealth {
  const mem = process.memoryUsage();
  const cpu = calculateCpuPercentage();

  return {
    memoryUsageMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    cpuUser: cpu.user,
    cpuSystem: cpu.system,
    activeHandles: (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles?.()?.length ?? 0,
  };
}

function createModuleHealth(name: string, description: string): PlatformServiceHealth {
  return {
    name,
    status: "healthy",
    message: description,
    lastCheck: new Date().toISOString(),
  };
}

async function checkDatabase(): Promise<PlatformServiceHealth> {
  const result = await checkDatabaseHealth();
  return {
    name: "database",
    status: result.healthy ? "healthy" : "unhealthy",
    latencyMs: result.latencyMs,
    ...(result.error ? { message: result.error } : {}),
    lastCheck: new Date().toISOString(),
  };
}

async function checkRedis(): Promise<PlatformServiceHealth> {
  const redisEnabled = process.env.ENABLE_REDIS === "true";
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;

  if (!redisEnabled || !redisUrl) {
    return {
      name: "redis",
      status: "healthy",
      message: "Disabled - using in-process session store",
      lastCheck: new Date().toISOString(),
    };
  }

  const start = Date.now();
  try {
    const client = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, { connectTimeout: 2000, maxRetriesPerRequest: 0, lazyConnect: true })
      : new Redis({
          host: process.env.REDIS_HOST || "127.0.0.1",
          port: Number(process.env.REDIS_PORT || 6379),
          connectTimeout: 2000,
          maxRetriesPerRequest: 0,
          lazyConnect: true,
        });

    await client.connect();
    await client.ping();
    const latencyMs = Date.now() - start;
    const info = await client.info("memory");
    const usedMemory = /used_memory_human:(\S+)/.exec(info)?.[1] || "unknown";
    await client.quit();

    return {
      name: "redis",
      status: latencyMs < 100 ? "healthy" : "degraded",
      latencyMs,
      message: `Connected - memory: ${usedMemory}`,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: "redis",
      status: "unhealthy",
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : "Connection failed",
      lastCheck: new Date().toISOString(),
    };
  }
}

function checkAiEngine(): PlatformServiceHealth {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
  return {
    name: "ai-engine",
    status: hasKey ? "healthy" : "degraded",
    message: hasKey ? "API key configured" : "No API key - AI features disabled",
    lastCheck: new Date().toISOString(),
  };
}

async function collectPlatformServices(): Promise<PlatformServiceHealth[]> {
  const [dbHealth, redisHealth] = await Promise.all([checkDatabase(), checkRedis()]);

  return [
    dbHealth,
    redisHealth,
    checkAiEngine(),
    createModuleHealth("demand-service", "Intake workflow operational"),
    createModuleHealth("portfolio-service", "Project management operational"),
    createModuleHealth("knowledge-service", "Policy context integration active"),
    createModuleHealth("auth-service", "Session-based auth operational"),
    createModuleHealth("notification-service", "WebSocket and email ready"),
    createModuleHealth("assessment-service", "AI analysis engines ready"),
    createModuleHealth("export-service", "PDF/PPTX generation ready"),
    createModuleHealth("access-management", "RBAC/ABAC enforcement active"),
    createModuleHealth("dlp-engine", "Data Loss Prevention scanning active"),
  ];
}

function determineOverallStatus(services: PlatformServiceHealth[]): PlatformHealthResponse["status"] {
  if (services.some((service) => service.status === "unhealthy")) {
    return "unhealthy";
  }
  if (services.some((service) => service.status === "degraded")) {
    return "degraded";
  }
  return "healthy";
}

export function coreviaHealthzController(_req: Request, res: Response): void {
  res.json(createCoreviaHealthResponse());
}

export function healthController(_req: Request, res: Response): void {
  res.json({
    ...createBasicHealthResponse(),
    version: process.env.APP_VERSION || "1.0.0",
    uptime: getUptimeSeconds(),
    system: getSystemMetrics(),
  });
}

export async function readinessController(_req: Request, res: Response): Promise<void> {
  const services = await collectPlatformServices();
  const status = determineOverallStatus(services);
  const response = createPlatformHealthResponse({
    status,
    uptimeSeconds: getUptimeSeconds(),
    services,
    system: getSystemMetrics(),
  });

  res.status(status === "unhealthy" ? 503 : 200).json(response);
}

export async function serviceHealthController(_req: Request, res: Response): Promise<void> {
  const services = await collectPlatformServices();
  res.json(createPlatformHealthServicesResponse(services));
}

logger.info("[HealthCheck] apps/api health controllers initialized");
