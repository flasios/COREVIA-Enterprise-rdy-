/**
 * COREVIA API Integration Hub — Connector Engine
 * ================================================
 * Enterprise-grade connector framework for integrating with ANY external system.
 * 
 * Supports:
 *  - REST, GraphQL, SOAP, Webhook protocols
 *  - OAuth2, API Key, Bearer Token, Basic Auth, Client Credentials
 *  - Request/response transformation & field mapping
 *  - Circuit breaker, retry, timeout patterns
 *  - Per-connector rate limiting
 *  - Full audit trail for government compliance
 *  - Health monitoring & status tracking
 */

import { EventEmitter } from "node:events";
import { logger } from "@platform/logging/Logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConnectorProtocol = "rest" | "graphql" | "soap" | "webhook" | "grpc";
export type AuthType = "none" | "api_key" | "bearer" | "basic" | "oauth2_client_credentials" | "oauth2_authorization_code" | "custom_header";
export type ConnectorStatus = "active" | "inactive" | "error" | "degraded" | "configuring";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type CircuitStateValue = "closed" | "open" | "half-open";

export interface ConnectorAuth {
  type: AuthType;
  // API Key
  apiKey?: string;
  apiKeyHeader?: string;        // default: "X-API-Key"
  apiKeyPrefix?: string;        // e.g. "Bearer", "Token"
  // Bearer
  bearerToken?: string;
  // Basic
  username?: string;
  password?: string;
  // OAuth2
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  scopes?: string[];
  authorizationUrl?: string;    // for auth-code flow
  redirectUri?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  // Custom header
  customHeaders?: Record<string, string>;
}

export interface RetryConfig {
  maxRetries: number;       // default: 3
  backoffMs: number;        // default: 1000
  backoffMultiplier: number; // default: 2
  retryOnStatus?: number[]; // e.g. [429, 502, 503, 504]
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour?: number;
  burstLimit?: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;   // failures before opening circuit
  resetTimeoutMs: number;     // ms to wait before half-open
  halfOpenRequests: number;   // requests allowed in half-open
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: "string" | "number" | "boolean" | "date" | "json" | "custom";
  customTransform?: string; // JS expression for custom mapping
  defaultValue?: unknown;
}

export interface ConnectorEndpoint {
  id: string;
  name: string;
  description?: string;
  method: HttpMethod;
  path: string;                  // relative to baseUrl, supports :param placeholders
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  requestBodyTemplate?: unknown;     // JSON template with {{variable}} placeholders
  requestMapping?: FieldMapping[];
  responseMapping?: FieldMapping[];
  timeout?: number;              // ms, overrides connector-level timeout
  cacheTtlSeconds?: number;      // response cache TTL
}

export interface ConnectorConfig {
  id: string;
  name: string;
  description: string;
  icon?: string;                 // lucide icon name
  category: string;              // e.g. "erp", "crm", "itsm", "hr", "custom"
  protocol: ConnectorProtocol;
  baseUrl: string;
  auth: ConnectorAuth;
  defaultHeaders?: Record<string, string>;
  timeout: number;               // ms, default 30000
  retry: RetryConfig;
  rateLimit?: RateLimitConfig;
  circuitBreaker: CircuitBreakerConfig;
  endpoints: ConnectorEndpoint[];
  healthCheck?: {
    endpoint: string;            // path to health endpoint
    method: HttpMethod;
    expectedStatus: number;
    intervalMs: number;          // check frequency
  };
  fieldMappings?: FieldMapping[]; // global field mappings
  metadata?: Record<string, unknown>;
  enabled: boolean;
  organizationId?: string;       // tenant scoping
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConnectorRequest {
  endpointId: string;
  params?: Record<string, string>;   // URL params (:id → value)
  query?: Record<string, string>;    // query string params
  body?: unknown;                        // request body
  headers?: Record<string, string>;  // additional headers
}

export interface ConnectorResponse {
  success: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  transformedData?: unknown;
  latencyMs: number;
  connectorId: string;
  endpointId: string;
  timestamp: string;
  requestId: string;
}

export interface ConnectorHealthStatus {
  connectorId: string;
  status: ConnectorStatus;
  lastCheck: string;
  latencyMs: number;
  consecutiveFailures: number;
  circuitState: CircuitStateValue;
  uptime?: number; // percentage
}

// ─── Circuit Breaker State ───────────────────────────────────────────────────

interface CircuitState {
  state: CircuitStateValue;
  failures: number;
  lastFailure?: Date;
  halfOpenRequests: number;
}

// ─── OAuth2 Token Cache ──────────────────────────────────────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

// ─── Rate Limiter State ──────────────────────────────────────────────────────

interface RateLimiterState {
  minuteRequests: number[];  // timestamps
  hourRequests: number[];
}

// ─── Connector Engine ────────────────────────────────────────────────────────

export class ConnectorEngine extends EventEmitter {
  private readonly connectors: Map<string, ConnectorConfig> = new Map();
  private readonly circuits: Map<string, CircuitState> = new Map();
  private readonly tokenCache: Map<string, TokenCache> = new Map();
  private readonly rateLimiters: Map<string, RateLimiterState> = new Map();
  private readonly healthStatuses: Map<string, ConnectorHealthStatus> = new Map();
  private readonly healthIntervals: Map<string, NodeJS.Timeout> = new Map();
  private requestCounter: number = 0;
  private static instance: ConnectorEngine;

  private constructor() {
    super();
  }

  private readString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }

  private buildRequestUrl(connector: ConnectorConfig, endpoint: ConnectorEndpoint, request: ConnectorRequest): string {
    let url = `${connector.baseUrl.replace(/\/$/, "")}/${endpoint.path.replace(/^\//, "")}`;

    if (request.params) {
      for (const [key, value] of Object.entries(request.params)) {
        url = url.replace(`:${key}`, encodeURIComponent(value));
      }
    }

    const queryParams = { ...endpoint.queryParams, ...request.query };
    if (Object.keys(queryParams).length > 0) {
      url += `?${new URLSearchParams(queryParams).toString()}`;
    }

    return url;
  }

  private async buildRequestHeaders(
    connector: ConnectorConfig,
    endpoint: ConnectorEndpoint,
    request: ConnectorRequest,
    requestId: string,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Request-ID": requestId,
      "X-Connector-ID": connector.id,
      ...connector.defaultHeaders,
      ...endpoint.headers,
      ...request.headers,
    };

    await this.applyAuth(connector, headers);
    return headers;
  }

  private buildRequestBody(endpoint: ConnectorEndpoint, request: ConnectorRequest): unknown {
    if (!["POST", "PUT", "PATCH"].includes(endpoint.method)) {
      return undefined;
    }

    let body = request.body;
    if (endpoint.requestBodyTemplate && body) {
      body = this.applyTemplate(endpoint.requestBodyTemplate, body);
    }

    if (endpoint.requestMapping && body) {
      body = this.applyFieldMappings(body, endpoint.requestMapping);
    }

    return body;
  }

  private async parseFetchResponse(fetchResponse: Response, endpoint: ConnectorEndpoint): Promise<{ data: unknown; transformedData: unknown; responseHeaders: Record<string, string> }> {
    const contentType = fetchResponse.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await fetchResponse.json()
      : await fetchResponse.text();

    if (!fetchResponse.ok) {
      const err = new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`) as Error & { status: number; data: unknown };
      err.status = fetchResponse.status;
      err.data = data;
      throw err;
    }

    const responseHeaders: Record<string, string> = {};
    fetchResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      data,
      transformedData: endpoint.responseMapping ? this.applyFieldMappings(data, endpoint.responseMapping) : data,
      responseHeaders,
    };
  }

  private applyApiKeyAuth(auth: ConnectorAuth, headers: Record<string, string>): void {
    const headerName = auth.apiKeyHeader || "X-API-Key";
    const prefix = auth.apiKeyPrefix ? `${auth.apiKeyPrefix} ` : "";
    headers[headerName] = `${prefix}${auth.apiKey || ""}`;
  }

  private applyBasicAuth(auth: ConnectorAuth, headers: Record<string, string>): void {
    const credentials = Buffer.from(`${auth.username || ""}:${auth.password || ""}`).toString("base64");
    headers.Authorization = `Basic ${credentials}`;
  }

  private async applyAuthorizationCodeAuth(connector: ConnectorConfig, headers: Record<string, string>): Promise<void> {
    const storedToken = this.tokenCache.get(connector.id);
    if (storedToken && storedToken.expiresAt > Date.now()) {
      headers.Authorization = `Bearer ${storedToken.accessToken}`;
      return;
    }

    const auth = connector.auth;
    if (auth.bearerToken && (!auth.tokenExpiresAt || auth.tokenExpiresAt > Date.now() + 60000)) {
      headers.Authorization = `Bearer ${auth.bearerToken}`;
      if (auth.tokenExpiresAt) {
        this.tokenCache.set(connector.id, {
          accessToken: auth.bearerToken,
          expiresAt: auth.tokenExpiresAt,
        });
      }
      return;
    }

    if (auth.refreshToken) {
      headers.Authorization = `Bearer ${await this.refreshAuthorizationCodeToken(connector)}`;
      return;
    }

    throw new Error("OAuth2 authorization-code connector is not authenticated");
  }

  static getInstance(): ConnectorEngine {
    if (!ConnectorEngine.instance) {
      ConnectorEngine.instance = new ConnectorEngine();
    }
    return ConnectorEngine.instance;
  }

  // ─── Connector Lifecycle ─────────────────────────────────────────────────

  registerConnector(config: ConnectorConfig): void {
    this.connectors.set(config.id, config);
    this.circuits.set(config.id, {
      state: "closed",
      failures: 0,
      halfOpenRequests: 0,
    });
    this.rateLimiters.set(config.id, { minuteRequests: [], hourRequests: [] });
    this.healthStatuses.set(config.id, {
      connectorId: config.id,
      status: config.enabled ? "active" : "inactive",
      lastCheck: new Date().toISOString(),
      latencyMs: 0,
      consecutiveFailures: 0,
      circuitState: "closed",
    });

    // Start health monitoring if configured
    if (config.healthCheck && config.enabled) {
      this.startHealthMonitor(config);
    }

    this.emit("connector:registered", { connectorId: config.id, name: config.name });
    logger.info(`[IntegrationHub] Connector registered: ${config.name} (${config.id})`);
  }

  unregisterConnector(connectorId: string): void {
    this.stopHealthMonitor(connectorId);
    this.connectors.delete(connectorId);
    this.circuits.delete(connectorId);
    this.tokenCache.delete(connectorId);
    this.rateLimiters.delete(connectorId);
    this.healthStatuses.delete(connectorId);
    this.emit("connector:unregistered", { connectorId });
    logger.info(`[IntegrationHub] Connector unregistered: ${connectorId}`);
  }

  updateConnector(connectorId: string, updates: Partial<ConnectorConfig>): void {
    const existing = this.connectors.get(connectorId);
    if (!existing) throw new Error(`Connector ${connectorId} not found`);

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.connectors.set(connectorId, updated);

    // Restart health monitor if config changed
    if (updates.healthCheck || updates.enabled !== undefined) {
      this.stopHealthMonitor(connectorId);
      if (updated.healthCheck && updated.enabled) {
        this.startHealthMonitor(updated);
      }
    }

    this.emit("connector:updated", { connectorId, updates: Object.keys(updates) });
  }

  getConnector(connectorId: string): ConnectorConfig | undefined {
    return this.connectors.get(connectorId);
  }

  listConnectors(): ConnectorConfig[] {
    return Array.from(this.connectors.values());
  }

  getConnectorsByCategory(category: string): ConnectorConfig[] {
    return Array.from(this.connectors.values()).filter(c => c.category === category);
  }

  // ─── Execute Request ─────────────────────────────────────────────────────

  async execute(connectorId: string, request: ConnectorRequest): Promise<ConnectorResponse> {
    const connector = this.connectors.get(connectorId);
    if (!connector) throw new Error(`Connector ${connectorId} not found`);
    if (!connector.enabled) throw new Error(`Connector ${connectorId} is disabled`);

    const endpoint = connector.endpoints.find(e => e.id === request.endpointId);
    if (!endpoint) throw new Error(`Endpoint ${request.endpointId} not found in connector ${connectorId}`);

    const requestId = `req_${++this.requestCounter}_${Date.now()}`;

    // Check circuit breaker
    this.checkCircuit(connectorId, connector.circuitBreaker);

    // Check rate limit
    this.checkRateLimit(connectorId, connector.rateLimit);

    const startTime = Date.now();

    try {
      const response = await this.executeWithRetry(connector, endpoint, request, requestId);
      
      // Record success
      this.recordSuccess(connectorId);
      
      this.emit("connector:request:success", {
        connectorId,
        endpointId: request.endpointId,
        requestId,
        latencyMs: response.latencyMs,
      });

      return response;
    } catch (error: unknown) {
      const latencyMs = Date.now() - startTime;

      // Record failure
      this.recordFailure(connectorId, connector.circuitBreaker);

      const errorResponse: ConnectorResponse = {
        success: false,
        status: (error as any).status || 500, // eslint-disable-line @typescript-eslint/no-explicit-any
        statusText: (error as Error).message || "Internal Error",
        headers: {},
        data: { error: (error as Error).message },
        latencyMs,
        connectorId,
        endpointId: request.endpointId,
        timestamp: new Date().toISOString(),
        requestId,
      };

      this.emit("connector:request:error", {
        connectorId,
        endpointId: request.endpointId,
        requestId,
        error: (error as Error).message,
        latencyMs,
      });

      return errorResponse;
    }
  }

  // ─── Internal: Execute with Retry ────────────────────────────────────────

  private async executeWithRetry(
    connector: ConnectorConfig,
    endpoint: ConnectorEndpoint,
    request: ConnectorRequest,
    requestId: string
  ): Promise<ConnectorResponse> {
    const retryConfig = connector.retry;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = retryConfig.backoffMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
          await new Promise(res => setTimeout(res, delay));
        }

        return await this.executeRequest(connector, endpoint, request, requestId);
      } catch (error: unknown) {
        lastError = error;
        
        // Only retry on configured status codes
        const retryStatuses = retryConfig.retryOnStatus || [429, 502, 503, 504];
        if ((error as any).status && !retryStatuses.includes((error as any).status)) { // eslint-disable-line @typescript-eslint/no-explicit-any
          throw error;
        }

        if (attempt === retryConfig.maxRetries) throw error;
      }
    }

    throw lastError;
  }

  // ─── Internal: Execute Single Request ────────────────────────────────────

  private async executeRequest(
    connector: ConnectorConfig,
    endpoint: ConnectorEndpoint,
    request: ConnectorRequest,
    requestId: string
  ): Promise<ConnectorResponse> {
    const url = this.buildRequestUrl(connector, endpoint, request);
    const headers = await this.buildRequestHeaders(connector, endpoint, request, requestId);
    const body = this.buildRequestBody(endpoint, request);

    const timeout = endpoint.timeout || connector.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const startTime = Date.now();

    try {
      const fetchResponse = await fetch(url, {
        method: endpoint.method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      const parsedResponse = await this.parseFetchResponse(fetchResponse, endpoint);

      return {
        success: true,
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: parsedResponse.responseHeaders,
        data: parsedResponse.data,
        transformedData: parsedResponse.transformedData,
        latencyMs,
        connectorId: connector.id,
        endpointId: endpoint.id,
        timestamp: new Date().toISOString(),
        requestId,
      };
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if ((error as Error).name === "AbortError") {
        const err = new Error(`Request timeout after ${timeout}ms`) as Error & { status: number };
        err.status = 408;
        throw err;
      }
      throw error;
    }
  }

  // ─── Auth Application ────────────────────────────────────────────────────

  private async applyAuth(connector: ConnectorConfig, headers: Record<string, string>): Promise<void> {
    const auth = connector.auth;

    switch (auth.type) {
      case "none":
        break;

      case "api_key": {
        this.applyApiKeyAuth(auth, headers);
        break;
      }

      case "bearer":
        headers["Authorization"] = `Bearer ${auth.bearerToken || ""}`;
        break;

      case "basic": {
        this.applyBasicAuth(auth, headers);
        break;
      }

      case "oauth2_client_credentials": {
        headers["Authorization"] = `Bearer ${await this.getOAuth2Token(connector)}`;
        break;
      }

      case "oauth2_authorization_code": {
        await this.applyAuthorizationCodeAuth(connector, headers);
        break;
      }

      case "custom_header":
        if (auth.customHeaders) {
          Object.assign(headers, auth.customHeaders);
        }
        break;
    }
  }

  private async refreshAuthorizationCodeToken(connector: ConnectorConfig): Promise<string> {
    const auth = connector.auth;
    if (!auth.tokenUrl || !auth.clientId || !auth.clientSecret || !auth.refreshToken) {
      throw new Error("OAuth2 authorization-code refresh requires tokenUrl, clientId, clientSecret, and refreshToken");
    }

    const response = await fetch(auth.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: auth.refreshToken,
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
        ...(auth.scopes?.length ? { scope: auth.scopes.join(" ") } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth2 refresh request failed: ${response.status} ${response.statusText}`);
    }

    const tokenData = await response.json() as Record<string, unknown>;
  const accessToken = this.readString(tokenData.access_token);
    const expiresInSeconds = Number(tokenData.expires_in || 3600);
    if (!accessToken) {
      throw new Error("OAuth2 refresh response did not include an access token");
    }

    this.tokenCache.set(connector.id, {
      accessToken,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    });

    connector.auth.bearerToken = accessToken;
    connector.auth.tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
    if (typeof tokenData.refresh_token === "string" && tokenData.refresh_token.length > 0) {
      connector.auth.refreshToken = tokenData.refresh_token;
    }

    return accessToken;
  }

  private async getOAuth2Token(connector: ConnectorConfig): Promise<string> {
    const cached = this.tokenCache.get(connector.id);
    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached.accessToken;
    }

    const auth = connector.auth;
    if (!auth.tokenUrl || !auth.clientId || !auth.clientSecret) {
      throw new Error("OAuth2 client credentials require tokenUrl, clientId, and clientSecret");
    }

    const response = await fetch(auth.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
        ...(auth.scopes?.length ? { scope: auth.scopes.join(" ") } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth2 token request failed: ${response.status} ${response.statusText}`);
    }

    const tokenData = await response.json() as Record<string, unknown>;
    this.tokenCache.set(connector.id, {
      accessToken: tokenData.access_token as string,
      expiresAt: Date.now() + ((tokenData.expires_in as number) || 3600) * 1000,
    });

    return tokenData.access_token as string;
  }

  // Store OAuth2 token (e.g. from auth code callback)
  storeOAuth2Token(connectorId: string, accessToken: string, expiresInSeconds: number): void {
    this.tokenCache.set(connectorId, {
      accessToken,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    });
  }

  // ─── Field Mapping ───────────────────────────────────────────────────────

  private applyFieldMappings(data: unknown, mappings: FieldMapping[]): unknown {
    if (!data || typeof data !== "object") return data;

    const result: Record<string, unknown> = {};
    for (const mapping of mappings) {
      let value = this.getNestedValue(data, mapping.sourceField);

      if (value === undefined && mapping.defaultValue !== undefined) {
        value = mapping.defaultValue;
      }

      if (value !== undefined && mapping.transform) {
        value = this.transformValue(value, mapping.transform);
      }

      this.setNestedValue(result, mapping.targetField, value);
    }

    return result;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split(".").reduce((current: unknown, key: string) => (current as Record<string, unknown>)?.[key], obj);
  }

  private setNestedValue(obj: unknown, path: string, value: unknown): void {
    const keys = path.split(".");
    let current = obj as Record<string, unknown>;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!key) {
        continue;
      }

      if (!current[key]) {
        current[key] = {};
      }

      current = current[key] as Record<string, unknown>;
    }
    const lastKey = keys.at(-1);
    if (lastKey) {
      current[lastKey] = value;
    }
  }

  private transformValue(value: unknown, transform: string): unknown {
    switch (transform) {
      case "string":
        if (typeof value === "string") return value;
        if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
        if (value && typeof value === "object") return JSON.stringify(value);
        return "";
      case "number": return Number(value);
      case "boolean": return Boolean(value);
      case "date": return new Date(value as string | number).toISOString();
      case "json": return typeof value === "string" ? JSON.parse(value) : value;
      default: return value;
    }
  }

  private applyTemplate(template: unknown, data: unknown): unknown {
    const json = JSON.stringify(template);
    const filled = json.replaceAll(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const value = this.getNestedValue(data, path);
      if (value === undefined) {
        return "";
      }

      return typeof value === "string" ? value : JSON.stringify(value);
    });
    return JSON.parse(filled);
  }

  // ─── Circuit Breaker ─────────────────────────────────────────────────────

  private checkCircuit(connectorId: string, config: CircuitBreakerConfig): void {
    const circuit = this.circuits.get(connectorId);
    if (!circuit) return;

    if (circuit.state === "open") {
      if (circuit.lastFailure && Date.now() - circuit.lastFailure.getTime() > config.resetTimeoutMs) {
        // Transition to half-open
        circuit.state = "half-open";
        circuit.halfOpenRequests = 0;
        this.updateHealthCircuitState(connectorId, "half-open");
      } else {
        throw Object.assign(new Error(`Circuit breaker OPEN for connector ${connectorId}`), { status: 503 });
      }
    }

    if (circuit.state === "half-open" && circuit.halfOpenRequests >= config.halfOpenRequests) {
      throw Object.assign(new Error(`Circuit breaker half-open limit reached for ${connectorId}`), { status: 503 });
    }

    if (circuit.state === "half-open") {
      circuit.halfOpenRequests++;
    }
  }

  private recordSuccess(connectorId: string): void {
    const circuit = this.circuits.get(connectorId);
    if (!circuit) return;

    if (circuit.state === "half-open") {
      // Success in half-open → close circuit
      circuit.state = "closed";
      circuit.failures = 0;
      circuit.halfOpenRequests = 0;
      this.updateHealthCircuitState(connectorId, "closed");
    }
    circuit.failures = 0;

    // Update health status
    const health = this.healthStatuses.get(connectorId);
    if (health) {
      health.consecutiveFailures = 0;
      if (health.status === "error" || health.status === "degraded") {
        health.status = "active";
      }
    }
  }

  private recordFailure(connectorId: string, config: CircuitBreakerConfig): void {
    const circuit = this.circuits.get(connectorId);
    if (!circuit) return;

    circuit.failures++;
    circuit.lastFailure = new Date();

    if (circuit.state === "half-open" || circuit.failures >= config.failureThreshold) {
      circuit.state = "open";
      this.updateHealthCircuitState(connectorId, "open");
    }

    // Update health status
    const health = this.healthStatuses.get(connectorId);
    if (health) {
      health.consecutiveFailures++;
      health.status = circuit.state === "open" ? "error" : "degraded";
    }
  }

  private updateHealthCircuitState(connectorId: string, state: "closed" | "open" | "half-open"): void {
    const health = this.healthStatuses.get(connectorId);
    if (health) {
      health.circuitState = state;
    }
    this.emit("connector:circuit", { connectorId, state });
  }

  // ─── Rate Limiting ───────────────────────────────────────────────────────

  private checkRateLimit(connectorId: string, config?: RateLimitConfig): void {
    if (!config) return;

    const limiter = this.rateLimiters.get(connectorId);
    if (!limiter) return;

    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const oneHourAgo = now - 3_600_000;

    // Clean old entries
    limiter.minuteRequests = limiter.minuteRequests.filter(t => t > oneMinuteAgo);
    limiter.hourRequests = limiter.hourRequests.filter(t => t > oneHourAgo);

    if (limiter.minuteRequests.length >= config.requestsPerMinute) {
      throw Object.assign(new Error(`Rate limit exceeded for connector ${connectorId} (${config.requestsPerMinute}/min)`), { status: 429 });
    }

    if (config.requestsPerHour && limiter.hourRequests.length >= config.requestsPerHour) {
      throw Object.assign(new Error(`Rate limit exceeded for connector ${connectorId} (${config.requestsPerHour}/hr)`), { status: 429 });
    }

    limiter.minuteRequests.push(now);
    limiter.hourRequests.push(now);
  }

  // ─── Health Monitoring ───────────────────────────────────────────────────

  private startHealthMonitor(connector: ConnectorConfig): void {
    const healthCheck = connector.healthCheck;
    if (!healthCheck) return;

    const check = async () => {
      const health = this.healthStatuses.get(connector.id);
      if (!health) return;

      try {
        const startTime = Date.now();
        const url = `${connector.baseUrl.replace(/\/$/, "")}/${healthCheck.endpoint.replace(/^\//, "")}`;
        const headers: Record<string, string> = { ...connector.defaultHeaders };
        await this.applyAuth(connector, headers);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(url, { 
          method: healthCheck.method, 
          headers,
          signal: controller.signal 
        });
        clearTimeout(timeout);

        health.latencyMs = Date.now() - startTime;
        health.lastCheck = new Date().toISOString();

        if (response.status === healthCheck.expectedStatus) {
          health.consecutiveFailures = 0;
          health.status = "active";
        } else {
          health.consecutiveFailures++;
          health.status = health.consecutiveFailures >= 3 ? "error" : "degraded";
        }
      } catch {
        health.consecutiveFailures++;
        health.latencyMs = -1;
        health.lastCheck = new Date().toISOString();
        health.status = health.consecutiveFailures >= 3 ? "error" : "degraded";
      }

      this.emit("connector:health", health);
    };

    const intervalMs = connector.healthCheck?.intervalMs;
    if (!intervalMs) {
      return;
    }

    // Initial check
    check();

    // Periodic checks
    const interval = setInterval(check, intervalMs);
    this.healthIntervals.set(connector.id, interval);
  }

  private stopHealthMonitor(connectorId: string): void {
    const interval = this.healthIntervals.get(connectorId);
    if (interval) {
      clearInterval(interval);
      this.healthIntervals.delete(connectorId);
    }
  }

  getHealthStatus(connectorId: string): ConnectorHealthStatus | undefined {
    return this.healthStatuses.get(connectorId);
  }

  getAllHealthStatuses(): ConnectorHealthStatus[] {
    return Array.from(this.healthStatuses.values());
  }

  // ─── Webhook Receiver ────────────────────────────────────────────────────

  async handleIncomingWebhook(connectorId: string, payload: unknown, headers: Record<string, string>): Promise<void> {
    const connector = this.connectors.get(connectorId);
    if (!connector) throw new Error(`Connector ${connectorId} not found`);
    if (connector.protocol !== "webhook") throw new Error(`Connector ${connectorId} is not a webhook connector`);

    this.emit("connector:webhook:received", {
      connectorId,
      payload,
      headers,
      timestamp: new Date().toISOString(),
    });
  }

  // ─── Test Connection ─────────────────────────────────────────────────────

  async testConnection(connectorId: string): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const connector = this.connectors.get(connectorId);
    if (!connector) return { success: false, latencyMs: 0, message: "Connector not found" };

    const startTime = Date.now();
    try {
      if (connector.healthCheck) {
        const url = `${connector.baseUrl.replace(/\/$/, "")}/${connector.healthCheck.endpoint.replace(/^\//, "")}`;
        const headers: Record<string, string> = { ...connector.defaultHeaders };
        await this.applyAuth(connector, headers);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, { method: connector.healthCheck.method, headers, signal: controller.signal });
        clearTimeout(timeout);

        return {
          success: response.status === connector.healthCheck.expectedStatus,
          latencyMs: Date.now() - startTime,
          message: response.status === connector.healthCheck.expectedStatus
            ? `Connection successful (HTTP ${response.status})`
            : `Unexpected status: ${response.status} ${response.statusText}`,
        };
      }

      // No health endpoint — try base URL
      const headers: Record<string, string> = { ...connector.defaultHeaders };
      await this.applyAuth(connector, headers);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(connector.baseUrl, { method: "GET", headers, signal: controller.signal });
      clearTimeout(timeout);

      return {
        success: response.ok,
        latencyMs: Date.now() - startTime,
        message: response.ok ? `Connection successful (HTTP ${response.status})` : `HTTP ${response.status}`,
      };
    } catch (error: unknown) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: (error as Error).message || "Connection failed",
      };
    }
  }

  // ─── Statistics ──────────────────────────────────────────────────────────

  getStats(): {
    totalConnectors: number;
    activeConnectors: number;
    errorConnectors: number;
    totalRequestsProcessed: number;
  } {
    const statuses = this.getAllHealthStatuses();
    return {
      totalConnectors: this.connectors.size,
      activeConnectors: statuses.filter(s => s.status === "active").length,
      errorConnectors: statuses.filter(s => s.status === "error").length,
      totalRequestsProcessed: this.requestCounter,
    };
  }

  // ─── Reset Circuit Breaker ───────────────────────────────────────────────

  resetCircuit(connectorId: string): void {
    const circuit = this.circuits.get(connectorId);
    if (circuit) {
      circuit.state = "closed";
      circuit.failures = 0;
      circuit.halfOpenRequests = 0;
      this.updateHealthCircuitState(connectorId, "closed");
    }
    const health = this.healthStatuses.get(connectorId);
    if (health) {
      health.consecutiveFailures = 0;
      health.status = "active";
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  destroy(): void {
    for (const [id] of this.healthIntervals) {
      this.stopHealthMonitor(id);
    }
    this.connectors.clear();
    this.circuits.clear();
    this.tokenCache.clear();
    this.rateLimiters.clear();
    this.healthStatuses.clear();
  }
}

export const connectorEngine = ConnectorEngine.getInstance();
