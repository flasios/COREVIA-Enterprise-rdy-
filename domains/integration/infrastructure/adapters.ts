/**
 * Integration Module — Infrastructure Adapters
 *
 * Concrete implementations of domain ports.
 * Each adapter wraps an existing legacy service.
 */

import type {
  ConnectorRegistryPort,
  ConnectorEnginePort,
  ConnectorCategoriesProvider,
} from "../domain/ports";

// ── Connector Registry ─────────────────────────────────────────────

export class LegacyConnectorRegistry implements ConnectorRegistryPort {
  private get reg() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./connectorRegistry").connectorRegistry;
  }
  getHubOverview() { return this.reg.getHubOverview(); }
  getTemplates() { return this.reg.getTemplates(); }
  getTemplatesByCategory(category: string) { return this.reg.getTemplatesByCategory(category); }
  listConnectors(opts: { category?: string; status?: string }) { return this.reg.listConnectors(opts); }
  getConnector(id: string) { return this.reg.getConnector(id); }
  getAuthorizationUrl(id: string, state?: string) { return this.reg.getAuthorizationUrl(id, state); }
  completeAuthorizationCodeFlow(id: string, code: string) { return this.reg.completeAuthorizationCodeFlow(id, code); }
  createConnector(body: Record<string, unknown>, userId?: string) { return this.reg.createConnector(body, userId); }
  createFromTemplate(templateId: string, opts: Record<string, unknown>, userId?: string) { return this.reg.createFromTemplate(templateId, opts, userId); }
  updateConnector(id: string, body: Record<string, unknown>) { return this.reg.updateConnector(id, body); }
  deleteConnector(id: string) { return this.reg.deleteConnector(id); }
  toggleConnector(id: string, enabled: boolean) { return this.reg.toggleConnector(id, enabled); }
  testConnection(id: string) { return this.reg.testConnection(id); }
  executeRequest(id: string, opts: Record<string, unknown>, userId?: string) { return this.reg.executeRequest(id, opts, userId); }
  getExecutionLogs(id: string, limit: number) { return this.reg.getExecutionLogs(id, limit); }
  getConnectorStats(id: string) { return this.reg.getConnectorStats(id); }
  getHealthStatuses() { return this.reg.getHealthStatuses(); }
  resetCircuitBreaker(id: string) { return this.reg.resetCircuitBreaker(id); }
  listWebhooks(id: string) { return this.reg.listWebhooks(id); }
  createWebhook(data: Record<string, unknown>) { return this.reg.createWebhook(data); }
}

// ── Connector Engine ───────────────────────────────────────────────

export class LegacyConnectorEngine implements ConnectorEnginePort {
  private get engine() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./connectorEngine").connectorEngine;
  }
  getHealthStatus(id: string) { return this.engine.getHealthStatus(id); }
  emit(event: string, data: Record<string, unknown>) { this.engine.emit(event, data); }
}

// ── Connector Categories ───────────────────────────────────────────

export class LegacyConnectorCategories implements ConnectorCategoriesProvider {
  getCategories() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./connectorTemplates").CONNECTOR_CATEGORIES;
  }
}
