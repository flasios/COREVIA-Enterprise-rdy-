/**
 * Integration Module — Domain Ports
 *
 * Pure interfaces for every external dependency the integration module needs.
 * Infrastructure adapters implement these; use-cases depend only on port types.
 *
 * NO concrete imports allowed.
 */

// ── Connector Registry ─────────────────────────────────────────────

export interface ConnectorRegistryPort {
  getHubOverview(): Promise<Record<string, unknown>>;
  getTemplates(): Array<Record<string, unknown>>;
  getTemplatesByCategory(category: string): Array<Record<string, unknown>>;
  listConnectors(opts: { category?: string; status?: string }): Promise<Array<Record<string, unknown>>>;
  getConnector(id: string): Promise<Record<string, unknown> | undefined>;
  getAuthorizationUrl(id: string, state?: string): Promise<string>;
  completeAuthorizationCodeFlow(id: string, code: string): Promise<Record<string, unknown>>;
  createConnector(body: Record<string, unknown>, userId?: string): Promise<Record<string, unknown>>;
  createFromTemplate(templateId: string, opts: Record<string, unknown>, userId?: string): Promise<Record<string, unknown>>;
  updateConnector(id: string, body: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
  deleteConnector(id: string): Promise<boolean>;
  toggleConnector(id: string, enabled: boolean): Promise<Record<string, unknown> | undefined>;
  testConnection(id: string): Promise<Record<string, unknown>>;
  executeRequest(id: string, opts: Record<string, unknown>, userId?: string): Promise<Record<string, unknown>>;
  getExecutionLogs(id: string, limit: number): Promise<Array<Record<string, unknown>>>;
  getConnectorStats(id: string): Promise<Record<string, unknown>>;
  getHealthStatuses(): Record<string, unknown>;
  resetCircuitBreaker(id: string): Promise<void>;
  listWebhooks(id: string): Promise<Array<Record<string, unknown>>>;
  createWebhook(data: Record<string, unknown>): Promise<Record<string, unknown>>;
}

// ── Connector Engine ───────────────────────────────────────────────

export interface ConnectorEnginePort {
  getHealthStatus(id: string): Record<string, unknown> | undefined;
  emit(event: string, data: Record<string, unknown>): void;
}

// ── Connector Categories (constant) ────────────────────────────────

export interface ConnectorCategoriesProvider {
  getCategories(): unknown[];
}
