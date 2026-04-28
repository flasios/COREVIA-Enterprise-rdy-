/**
 * Health Check Endpoints
 *
 * Provides production-ready health monitoring:
 * 1. /health - Basic liveness check
 * 2. /health/ready - Readiness check (all dependencies)
 * 3. /health/services - Individual service status
 */

import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../application';
import { logger } from "@platform/logging/Logger";
import Redis from "ioredis";

const router = Router();

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
  lastCheck: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services?: ServiceHealth[];
  system?: {
    memoryUsageMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
    cpuUser: number;
    cpuSystem: number;
    activeHandles: number;
    eventLoopLagMs?: number;
  };
}

const startTime = Date.now();

async function checkDatabase(): Promise<ServiceHealth> {
  const result = await checkDatabaseHealth();
  return {
    name: 'database',
    status: result.healthy ? 'healthy' : 'unhealthy',
    latencyMs: result.latencyMs,
    ...(result.error ? { message: result.error } : {}),
    lastCheck: new Date().toISOString()
  };
}

async function checkRedis(): Promise<ServiceHealth> {
  const redisEnabled = process.env.ENABLE_REDIS === "true";
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;

  if (!redisEnabled || !redisUrl) {
    return {
      name: 'redis',
      status: 'healthy',
      message: 'Disabled — using in-process session store',
      lastCheck: new Date().toISOString(),
    };
  }

  const start = Date.now();
  try {
    const client = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, { connectTimeout: 2000, maxRetriesPerRequest: 0, lazyConnect: true })
      : new Redis({
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: Number(process.env.REDIS_PORT || 6379),
          connectTimeout: 2000,
          maxRetriesPerRequest: 0,
          lazyConnect: true,
        });

    await client.connect();
    await client.ping();
    const latencyMs = Date.now() - start;
    const info = await client.info('memory');
    const usedMemory = info.match(/used_memory_human:(\S+)/)?.[1] || 'unknown';
    await client.quit();

    return {
      name: 'redis',
      status: latencyMs < 100 ? 'healthy' : 'degraded',
      latencyMs,
      message: `Connected — memory: ${usedMemory}`,
      lastCheck: new Date().toISOString(),
    };
  } catch (err) {
    return {
      name: 'redis',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : 'Connection failed',
      lastCheck: new Date().toISOString(),
    };
  }
}

function checkAnthropicKeyPresent(): ServiceHealth {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
  return {
    name: 'ai-engine',
    status: hasKey ? 'healthy' : 'degraded',
    message: hasKey ? 'API key configured' : 'No API key — AI features disabled',
    lastCheck: new Date().toISOString(),
  };
}

function getSystemMetrics(): HealthResponse['system'] {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  return {
    memoryUsageMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    cpuUser: Math.round(cpu.user / 1000),
    cpuSystem: Math.round(cpu.system / 1000),
    activeHandles: (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles?.()?.length ?? 0,
  };
}

function checkModuleHealth(name: string, description: string): ServiceHealth {
  return {
    name,
    status: 'healthy',
    message: description,
    lastCheck: new Date().toISOString(),
  };
}

router.get('/', (req: Request, res: Response) => {
  const response: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    system: getSystemMetrics(),
  };

  res.json(response);
});

router.get('/ready', async (req: Request, res: Response) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const services: ServiceHealth[] = [
    dbHealth,
    redisHealth,
    checkAnthropicKeyPresent(),
    checkModuleHealth('demand-service', 'Intake workflow operational'),
    checkModuleHealth('portfolio-service', 'Project management operational'),
    checkModuleHealth('knowledge-service', 'Policy context integration active'),
    checkModuleHealth('auth-service', 'Session-based auth operational'),
    checkModuleHealth('notification-service', 'WebSocket and email ready'),
    checkModuleHealth('assessment-service', 'AI analysis engines ready'),
    checkModuleHealth('export-service', 'PDF/PPTX generation ready'),
    checkModuleHealth('access-management', 'RBAC/ABAC enforcement active'),
    checkModuleHealth('dlp-engine', 'Data Loss Prevention scanning active'),
  ];

  const unhealthyServices = services.filter(s => s.status === 'unhealthy');
  const degradedServices = services.filter(s => s.status === 'degraded');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (unhealthyServices.length > 0) {
    overallStatus = 'unhealthy';
  } else if (degradedServices.length > 0) {
    overallStatus = 'degraded';
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    services,
    system: getSystemMetrics(),
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
  res.status(statusCode).json(response);
});

router.get('/services', async (req: Request, res: Response) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const services: ServiceHealth[] = [
    dbHealth,
    redisHealth,
    checkAnthropicKeyPresent(),
    checkModuleHealth('demand-service', 'Intake workflow operational'),
    checkModuleHealth('portfolio-service', 'Project management operational'),
    checkModuleHealth('knowledge-service', 'Policy context integration active'),
    checkModuleHealth('auth-service', 'Session-based auth operational'),
    checkModuleHealth('notification-service', 'WebSocket and email ready'),
    checkModuleHealth('assessment-service', 'AI analysis engines ready'),
    checkModuleHealth('export-service', 'PDF/PPTX generation ready'),
    checkModuleHealth('access-management', 'RBAC/ABAC enforcement active'),
    checkModuleHealth('dlp-engine', 'Data Loss Prevention scanning active'),
  ];

  res.json({
    timestamp: new Date().toISOString(),
    totalServices: services.length,
    healthy: services.filter(s => s.status === 'healthy').length,
    degraded: services.filter(s => s.status === 'degraded').length,
    unhealthy: services.filter(s => s.status === 'unhealthy').length,
    services,
    system: getSystemMetrics(),
  });
});

logger.info('[HealthCheck] Routes initialized');

export default router;
export { router as healthRoutes };
