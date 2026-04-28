/**
 * COREVIA API Integration Hub — Connector Registry Service
 * ==========================================================
 * Manages connector lifecycle — CRUD, DB persistence, logging, and audit trail.
 * Bridges the in-memory ConnectorEngine with the database.
 */

import { db } from "@platform/db";
import { eq, desc, and, sql, count, gte } from "drizzle-orm";
import { connectorEngine, type ConnectorConfig, type ConnectorRequest, type ConnectorResponse, type ConnectorAuth } from "./connectorEngine";
import { apiConnectors, connectorExecutionLogs, webhookRegistrations, type InsertApiConnector } from "@shared/schemas/corevia/integrationHub";
import { CONNECTOR_TEMPLATES, getTemplateById, type ConnectorTemplate } from "./connectorTemplates";
import { logger } from "@platform/logging/Logger";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function requireConnectorRow<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

function isInfraUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const anyErr = error as Record<string, unknown>;
  if (anyErr.code === "ECONNREFUSED") return true;
  if (typeof anyErr.message === "string" && anyErr.message.includes("ECONNREFUSED")) return true;
  if (Array.isArray(anyErr.errors)) {
    return anyErr.errors.some((e: Record<string, unknown>) => e?.code === "ECONNREFUSED" || (typeof e?.message === "string" && e.message.includes("ECONNREFUSED")));
  }
  return false;
}

export class ConnectorRegistryService {
  private static instance: ConnectorRegistryService;

  static getInstance(): ConnectorRegistryService {
    if (!ConnectorRegistryService.instance) {
      ConnectorRegistryService.instance = new ConnectorRegistryService();
    }
    return ConnectorRegistryService.instance;
  }

  // ─── Initialize — Load connectors from DB into engine ────────────────────

  async initialize(): Promise<void> {
    try {
      const rows = await db.select().from(apiConnectors).where(eq(apiConnectors.enabled, true));
      let loaded = 0;

      for (const row of rows) {
        try {
          const config = this.rowToConfig(row);
          connectorEngine.registerConnector(config);
          loaded++;
        } catch (err: unknown) {
          logger.error(`[IntegrationHub] Failed to load connector ${row.id}: ${getErrorMessage(err)}`);
        }
      }

      // Listen for execution events for audit logging
      this.attachEventListeners();

      logger.info(`[IntegrationHub] Loaded ${loaded} active connectors from database`);
    } catch (err: unknown) {
      if (isInfraUnavailableError(err)) {
        logger.warn("[IntegrationHub] Registry init skipped (database unavailable). Start infra with: npm run dev:infra");
        return;
      }

      logger.error(`[IntegrationHub] Registry init error: ${getErrorMessage(err)}`);
    }
  }

  // ─── Create Connector ────────────────────────────────────────────────────

  async createConnector(data: InsertApiConnector, userId?: string): Promise<typeof apiConnectors.$inferSelect> {
    const now = new Date();
    const values = {
      ...data,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    const [row] = await db.insert(apiConnectors).values(values).returning();
    const createdRow = requireConnectorRow(row, "Failed to create connector");

    // Register in engine if enabled
    if (createdRow.enabled) {
      const config = this.rowToConfig(createdRow);
      connectorEngine.registerConnector(config);
    }

    return createdRow;
  }

  // ─── Create From Template ────────────────────────────────────────────────

  async createFromTemplate(
    templateId: string,
    overrides: {
      baseUrl?: string;
      auth?: Partial<ConnectorAuth>;
      name?: string;
      organizationId?: string;
    },
    userId?: string
  ): Promise<typeof apiConnectors.$inferSelect> {
    const template = getTemplateById(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    const connectorId = `${template.id}-${Date.now().toString(36)}`;
    const authConfig: Record<string, unknown> = {};

    // Map auth overrides to authConfig
    if (overrides.auth) {
      Object.assign(authConfig, overrides.auth);
    }

    return this.createConnector({
      id: connectorId,
      name: overrides.name || template.name,
      description: template.description,
      icon: template.icon,
      category: template.category,
      protocol: template.protocol,
      baseUrl: overrides.baseUrl || template.baseUrl,
      authType: template.authType,
      authConfig: authConfig as InsertApiConnector["authConfig"],
      defaultHeaders: template.defaultHeaders || {},
      timeout: template.timeout,
      retryConfig: template.retry,
      rateLimitConfig: undefined,
      circuitBreakerConfig: template.circuitBreaker,
      healthCheckConfig: template.healthCheck || null,
      endpoints: template.endpoints,
      fieldMappings: [],
      metadata: { templateId: template.id, documentationUrl: template.documentationUrl },
      enabled: false,  // Start disabled until credentials are configured
      status: "configuring",
      organizationId: overrides.organizationId,
    }, userId);
  }

  async getAuthorizationUrl(connectorId: string, state?: string): Promise<string> {
    const row = await this.getConnector(connectorId);
    if (!row) {
      throw new Error("Connector not found");
    }

    const config = this.rowToConfig(row);
    if (config.auth.type !== "oauth2_authorization_code") {
      throw new Error("Connector does not use OAuth2 authorization code flow");
    }
    if (!config.auth.authorizationUrl || !config.auth.clientId || !config.auth.redirectUri) {
      throw new Error("Connector is missing authorizationUrl, clientId, or redirectUri");
    }

    const authorizationUrl = new URL(config.auth.authorizationUrl);
    authorizationUrl.searchParams.set("client_id", config.auth.clientId);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("redirect_uri", config.auth.redirectUri);
    authorizationUrl.searchParams.set("response_mode", "query");
    authorizationUrl.searchParams.set("scope", config.auth.scopes?.length ? config.auth.scopes.join(" ") : "openid profile email offline_access");
    if (state) {
      authorizationUrl.searchParams.set("state", state);
    }

    return authorizationUrl.toString();
  }

  async completeAuthorizationCodeFlow(connectorId: string, code: string): Promise<typeof apiConnectors.$inferSelect> {
    const row = await this.getConnector(connectorId);
    if (!row) {
      throw new Error("Connector not found");
    }

    const config = this.rowToConfig(row);
    if (config.auth.type !== "oauth2_authorization_code") {
      throw new Error("Connector does not use OAuth2 authorization code flow");
    }
    if (!config.auth.tokenUrl || !config.auth.clientId || !config.auth.clientSecret || !config.auth.redirectUri) {
      throw new Error("Connector is missing tokenUrl, clientId, clientSecret, or redirectUri");
    }

    const response = await fetch(config.auth.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: config.auth.clientId,
        client_secret: config.auth.clientSecret,
        redirect_uri: config.auth.redirectUri,
        ...(config.auth.scopes?.length ? { scope: config.auth.scopes.join(" ") } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth2 token exchange failed: ${response.status} ${response.statusText}`);
    }

    const tokenData = await response.json() as Record<string, unknown>;
    const accessToken = asString(tokenData.access_token);
    if (!accessToken) {
      throw new Error("OAuth2 token exchange did not return an access token");
    }

    const expiresInSeconds = asNumber(tokenData.expires_in) ?? 3600;
    const refreshToken = asString(tokenData.refresh_token);
    connectorEngine.storeOAuth2Token(connectorId, accessToken, expiresInSeconds);

    const currentAuthConfig = asRecord(row.authConfig || {});
    const nextAuthConfig = {
      ...currentAuthConfig,
      bearerToken: accessToken,
      refreshToken: refreshToken || currentAuthConfig.refreshToken,
      tokenExpiresAt: Date.now() + expiresInSeconds * 1000,
    };

    const [updated] = await db
      .update(apiConnectors)
      .set({
        authConfig: nextAuthConfig,
        enabled: true,
        status: "active",
        lastTestedAt: new Date(),
        lastTestResult: { success: true, message: "OAuth authorization completed" },
        updatedAt: new Date(),
      })
      .where(eq(apiConnectors.id, connectorId))
      .returning();

    if (!updated) {
      throw new Error("Connector update failed after OAuth token exchange");
    }

    connectorEngine.unregisterConnector(connectorId);
    connectorEngine.registerConnector(this.rowToConfig(updated));

    return updated;
  }

  // ─── Update Connector ────────────────────────────────────────────────────

  async updateConnector(connectorId: string, updates: Partial<InsertApiConnector>): Promise<typeof apiConnectors.$inferSelect | null> {
    const [row] = await db
      .update(apiConnectors)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(apiConnectors.id, connectorId))
      .returning();

    if (!row) return null;

    // Re-register in engine
    if (connectorEngine.getConnector(connectorId)) {
      connectorEngine.unregisterConnector(connectorId);
    }
    if (row.enabled) {
      const config = this.rowToConfig(row);
      connectorEngine.registerConnector(config);
    }

    return row;
  }

  // ─── Delete Connector ────────────────────────────────────────────────────

  async deleteConnector(connectorId: string): Promise<boolean> {
    connectorEngine.unregisterConnector(connectorId);
    const result = await db.delete(apiConnectors).where(eq(apiConnectors.id, connectorId)).returning();
    return result.length > 0;
  }

  // ─── Get / List ──────────────────────────────────────────────────────────

  async getConnector(connectorId: string): Promise<typeof apiConnectors.$inferSelect | null> {
    const [row] = await db.select().from(apiConnectors).where(eq(apiConnectors.id, connectorId));
    return row || null;
  }

  async listConnectors(filters?: { category?: string; status?: string; organizationId?: string }): Promise<(typeof apiConnectors.$inferSelect)[]> {
    const conditions = [];
    if (filters?.category) conditions.push(eq(apiConnectors.category, filters.category));
    if (filters?.status) conditions.push(eq(apiConnectors.status, filters.status));
    if (filters?.organizationId) conditions.push(eq(apiConnectors.organizationId, filters.organizationId));

    if (conditions.length > 0) {
      return db.select().from(apiConnectors).where(and(...conditions)).orderBy(desc(apiConnectors.createdAt));
    }

    return db.select().from(apiConnectors).orderBy(desc(apiConnectors.createdAt));
  }

  // ─── Toggle Enable/Disable ──────────────────────────────────────────────

  async toggleConnector(connectorId: string, enabled: boolean): Promise<typeof apiConnectors.$inferSelect | null> {
    return this.updateConnector(connectorId, {
      enabled,
      status: enabled ? "active" : "inactive",
    } as Record<string, unknown>);
  }

  // ─── Execute Request Through Connector ────────────────────────────────

  async executeRequest(connectorId: string, request: ConnectorRequest, userId?: string): Promise<ConnectorResponse> {
    const response = await connectorEngine.execute(connectorId, request);

    // Log execution
    try {
      const connector = connectorEngine.getConnector(connectorId);
      const endpoint = connector?.endpoints?.find(e => e.id === request.endpointId);

      await db.insert(connectorExecutionLogs).values({
        connectorId,
        endpointId: request.endpointId,
        requestId: response.requestId,
        method: endpoint?.method || "GET",
        url: `${connector?.baseUrl || ""}/${endpoint?.path || ""}`,
        requestHeaders: request.headers || {},
        requestBody: request.body ? { _redacted: true } : null, // Don't log sensitive body
        responseStatus: response.status,
        responseHeaders: response.headers,
        responseBody: response.success ? { _summary: "success" } : { error: response.statusText },
        latencyMs: response.latencyMs,
        success: response.success,
        errorMessage: response.success ? null : response.statusText,
        userId,
        organizationId: connector?.organizationId,
      });
    } catch (logErr: unknown) {
      logger.error(`[IntegrationHub] Failed to log execution: ${getErrorMessage(logErr)}`);
    }

    return response;
  }

  // ─── Test Connection ─────────────────────────────────────────────────────

  async testConnection(connectorId: string): Promise<{ success: boolean; latencyMs: number; message: string }> {
    // Ensure connector is registered in engine
    const row = await this.getConnector(connectorId);
    if (!row) return { success: false, latencyMs: 0, message: "Connector not found" };

    if (!connectorEngine.getConnector(connectorId)) {
      const config = this.rowToConfig(row);
      connectorEngine.registerConnector(config);
    }

    const result = await connectorEngine.testConnection(connectorId);

    // Update test result in DB
    let resolvedStatus: "active" | "inactive" | "error" = "error";
    if (result.success) {
      resolvedStatus = row.enabled ? "active" : "inactive";
    }
    await db.update(apiConnectors).set({
      lastTestedAt: new Date(),
      lastTestResult: result,
      status: resolvedStatus,
      updatedAt: new Date(),
    }).where(eq(apiConnectors.id, connectorId));

    return result;
  }

  // ─── Get Execution Logs ──────────────────────────────────────────────────

  async getExecutionLogs(connectorId: string, limit = 50): Promise<(typeof connectorExecutionLogs.$inferSelect)[]> {
    return db
      .select()
      .from(connectorExecutionLogs)
      .where(eq(connectorExecutionLogs.connectorId, connectorId))
      .orderBy(desc(connectorExecutionLogs.createdAt))
      .limit(limit);
  }

  // ─── Get Connector Stats ─────────────────────────────────────────────────

  async getConnectorStats(connectorId: string): Promise<{
    totalRequests: number;
    successRate: number;
    avgLatencyMs: number;
    last24hRequests: number;
    last24hErrors: number;
  }> {
    const twentyFourHoursAgo = new Date(Date.now() - 86400000);

    const [total] = await db
      .select({ count: count() })
      .from(connectorExecutionLogs)
      .where(eq(connectorExecutionLogs.connectorId, connectorId));

    const [successful] = await db
      .select({ count: count() })
      .from(connectorExecutionLogs)
      .where(and(eq(connectorExecutionLogs.connectorId, connectorId), eq(connectorExecutionLogs.success, true)));

    const [avgLatency] = await db
      .select({ avg: sql<number>`COALESCE(AVG(${connectorExecutionLogs.latencyMs}), 0)` })
      .from(connectorExecutionLogs)
      .where(eq(connectorExecutionLogs.connectorId, connectorId));

    const [last24h] = await db
      .select({ count: count() })
      .from(connectorExecutionLogs)
      .where(and(
        eq(connectorExecutionLogs.connectorId, connectorId),
        gte(connectorExecutionLogs.createdAt, twentyFourHoursAgo)
      ));

    const [last24hErrs] = await db
      .select({ count: count() })
      .from(connectorExecutionLogs)
      .where(and(
        eq(connectorExecutionLogs.connectorId, connectorId),
        eq(connectorExecutionLogs.success, false),
        gte(connectorExecutionLogs.createdAt, twentyFourHoursAgo)
      ));

    const totalCount = total?.count || 0;
    const successCount = successful?.count || 0;

    return {
      totalRequests: totalCount,
      successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100,
      avgLatencyMs: Math.round(avgLatency?.avg || 0),
      last24hRequests: last24h?.count || 0,
      last24hErrors: last24hErrs?.count || 0,
    };
  }

  // ─── Get Hub Overview ────────────────────────────────────────────────────

  async getHubOverview(): Promise<{
    totalConnectors: number;
    activeConnectors: number;
    errorConnectors: number;
    categories: { category: string; count: number }[];
    recentActivity: (typeof connectorExecutionLogs.$inferSelect)[];
    engineStats: ReturnType<typeof connectorEngine.getStats>;
  }> {
    const all = await db.select().from(apiConnectors);
    const active = all.filter(c => c.status === "active" && c.enabled);
    const errors = all.filter(c => c.status === "error");

    const categoryMap = new Map<string, number>();
    for (const c of all) {
      categoryMap.set(c.category, (categoryMap.get(c.category) || 0) + 1);
    }

    const recentActivity = await db
      .select()
      .from(connectorExecutionLogs)
      .orderBy(desc(connectorExecutionLogs.createdAt))
      .limit(20);

    return {
      totalConnectors: all.length,
      activeConnectors: active.length,
      errorConnectors: errors.length,
      categories: Array.from(categoryMap.entries()).map(([category, cnt]) => ({ category, count: cnt })),
      recentActivity,
      engineStats: connectorEngine.getStats(),
    };
  }

  // ─── Templates ───────────────────────────────────────────────────────────

  getTemplates(): ConnectorTemplate[] {
    return CONNECTOR_TEMPLATES;
  }

  getTemplatesByCategory(category: string): ConnectorTemplate[] {
    return CONNECTOR_TEMPLATES.filter(t => t.category === category);
  }

  // ─── Webhook Management ──────────────────────────────────────────────────

  async createWebhook(data: {
    connectorId: string;
    name: string;
    description?: string;
    secret?: string;
    eventTypes?: string[];
    targetAction?: string;
    organizationId?: string;
  }): Promise<typeof webhookRegistrations.$inferSelect> {
    const id = `wh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const [row] = await db.insert(webhookRegistrations).values({
      id,
      ...data,
      eventTypes: data.eventTypes || ["*"],
      enabled: true,
    }).returning();
    return row!;
  }

  async listWebhooks(connectorId: string): Promise<(typeof webhookRegistrations.$inferSelect)[]> {
    return db.select().from(webhookRegistrations).where(eq(webhookRegistrations.connectorId, connectorId));
  }

  // ─── Reset Circuit Breaker ───────────────────────────────────────────────

  async resetCircuitBreaker(connectorId: string): Promise<void> {
    connectorEngine.resetCircuit(connectorId);
    await db.update(apiConnectors).set({
      status: "active",
      updatedAt: new Date(),
    }).where(eq(apiConnectors.id, connectorId));
  }

  // ─── Health ──────────────────────────────────────────────────────────────

  getHealthStatuses() {
    return connectorEngine.getAllHealthStatuses();
  }

  // ─── Internal: DB row → ConnectorConfig ──────────────────────────────────

  private rowToConfig(row: typeof apiConnectors.$inferSelect): ConnectorConfig {
    const authConfig = asRecord(row.authConfig || {});
    const endpoints = Array.isArray(row.endpoints) ? row.endpoints as ConnectorConfig["endpoints"] : [];
    const fieldMappings = Array.isArray(row.fieldMappings) ? row.fieldMappings as NonNullable<ConnectorConfig["fieldMappings"]> : [];

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon || undefined,
      category: row.category,
      protocol: row.protocol as ConnectorConfig["protocol"],
      baseUrl: row.baseUrl,
      auth: {
        type: row.authType as ConnectorAuth["type"],
        apiKey: asString(authConfig.apiKey),
        apiKeyHeader: asString(authConfig.apiKeyHeader),
        apiKeyPrefix: asString(authConfig.apiKeyPrefix),
        bearerToken: asString(authConfig.bearerToken),
        username: asString(authConfig.username),
        password: asString(authConfig.password),
        clientId: asString(authConfig.clientId),
        clientSecret: asString(authConfig.clientSecret),
        tokenUrl: asString(authConfig.tokenUrl),
        scopes: asStringArray(authConfig.scopes),
        authorizationUrl: asString(authConfig.authorizationUrl),
        redirectUri: asString(authConfig.redirectUri),
        refreshToken: asString(authConfig.refreshToken),
        tokenExpiresAt: asNumber(authConfig.tokenExpiresAt),
        customHeaders: asStringRecord(authConfig.customHeaders),
      },
      defaultHeaders: (row.defaultHeaders as Record<string, string>) || {},
      timeout: row.timeout,
      retry: row.retryConfig as ConnectorConfig["retry"],
      rateLimit: row.rateLimitConfig as ConnectorConfig["rateLimit"] || undefined,
      circuitBreaker: row.circuitBreakerConfig as ConnectorConfig["circuitBreaker"],
      endpoints,
      healthCheck: row.healthCheckConfig as ConnectorConfig["healthCheck"] || undefined,
      fieldMappings,
      metadata: (row.metadata as Record<string, unknown>) || {},
      enabled: row.enabled,
      organizationId: row.organizationId || undefined,
      createdBy: row.createdBy || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ─── Internal: Event Listeners ───────────────────────────────────────────

  private attachEventListeners(): void {
    connectorEngine.on("connector:circuit", ({ connectorId, state }) => {
      if (state === "open") {
        db.update(apiConnectors)
          .set({ status: "error", updatedAt: new Date() })
          .where(eq(apiConnectors.id, connectorId))
          .then(() => {})
          .catch(() => {});
      } else if (state === "closed") {
        db.update(apiConnectors)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(apiConnectors.id, connectorId))
          .then(() => {})
          .catch(() => {});
      }
    });
  }
}

export const connectorRegistry = ConnectorRegistryService.getInstance();
