export interface BasicHealthResponse {
  status: "healthy";
  timestamp: string;
}

export type PlatformServiceStatus = "healthy" | "degraded" | "unhealthy";

export interface PlatformServiceHealth {
  name: string;
  status: PlatformServiceStatus;
  latencyMs?: number;
  message?: string;
  lastCheck: string;
}

export interface PlatformSystemHealth {
  memoryUsageMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
  cpuUser: number;
  cpuSystem: number;
  activeHandles: number;
  eventLoopLagMs?: number;
}

export interface PlatformHealthResponse {
  status: PlatformServiceStatus;
  timestamp: string;
  version: string;
  uptime: number;
  services?: PlatformServiceHealth[];
  system?: PlatformSystemHealth;
}

export interface PlatformHealthServicesResponse {
  timestamp: string;
  totalServices: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  services: PlatformServiceHealth[];
}

export interface CoreviaHealthComponent {
  status: "operational";
}

export interface CoreviaPipelineHealth extends CoreviaHealthComponent {
  layers: number;
}

export interface CoreviaIntelligenceHealth extends CoreviaHealthComponent {
  engines: string[];
}

export interface CoreviaHealthResponse {
  status: "healthy";
  timestamp: string;
  components: {
    pipeline: CoreviaPipelineHealth;
    intelligence: CoreviaIntelligenceHealth;
    agents: CoreviaHealthComponent;
    rag: CoreviaHealthComponent;
  };
  version: string;
}

export function createBasicHealthResponse(): BasicHealthResponse {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
  };
}

export function createPlatformHealthResponse(params: {
  status: PlatformServiceStatus;
  version?: string;
  uptimeSeconds: number;
  services?: PlatformServiceHealth[];
  system?: PlatformSystemHealth;
}): PlatformHealthResponse {
  return {
    status: params.status,
    timestamp: new Date().toISOString(),
    version: params.version || process.env.APP_VERSION || "1.0.0",
    uptime: params.uptimeSeconds,
    ...(params.services ? { services: params.services } : {}),
    ...(params.system ? { system: params.system } : {}),
  };
}

export function createPlatformHealthServicesResponse(
  services: PlatformServiceHealth[],
): PlatformHealthServicesResponse {
  return {
    timestamp: new Date().toISOString(),
    totalServices: services.length,
    healthy: services.filter((service) => service.status === "healthy").length,
    degraded: services.filter((service) => service.status === "degraded").length,
    unhealthy: services.filter((service) => service.status === "unhealthy").length,
    services,
  };
}

export function createCoreviaHealthResponse(): CoreviaHealthResponse {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    components: {
      pipeline: { status: "operational", layers: 8 },
      intelligence: {
        status: "operational",
        engines: ["internal", "hybrid", "distillation"],
      },
      agents: { status: "operational" },
      rag: { status: "operational" },
    },
    version: "1.0.0",
  };
}