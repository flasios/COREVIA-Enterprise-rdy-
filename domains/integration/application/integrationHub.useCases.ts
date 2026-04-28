import type { IntegrationHubDeps } from "./buildDeps";
import { type PortResult, ok, fail } from "./shared";


// ═══════════════════════════════════════════════════════════════════
//  INTEGRATION HUB USE-CASES
// ═══════════════════════════════════════════════════════════════════

export async function getHubOverview(
  deps: Pick<IntegrationHubDeps, "registry">,
): Promise<PortResult> {
  try {
    const overview = await deps.registry.getHubOverview();
    return ok(overview);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export function getTemplates(
  deps: Pick<IntegrationHubDeps, "registry">,
  category?: string,
): PortResult {
  const templates = category
    ? deps.registry.getTemplatesByCategory(category)
    : deps.registry.getTemplates();

  const safe = templates.map((t: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: t.id,
    name: t.name,
    description: t.description,
    icon: t.icon,
    category: t.category,
    protocol: t.protocol,
    authType: t.authType,
    requiredFields: t.requiredFields,
    endpointCount: t.endpoints.length,
    endpoints: t.endpoints.map((e: any) => ({ id: e.id, name: e.name, method: e.method, path: e.path })), // eslint-disable-line @typescript-eslint/no-explicit-any
    documentationUrl: t.documentationUrl,
  }));

  return ok(safe);
}

export function getCategories(
  deps: Pick<IntegrationHubDeps, "categories">,
): PortResult {
  return ok(deps.categories.getCategories());
}

export async function listConnectors(
  deps: Pick<IntegrationHubDeps, "registry" | "engine">,
  category?: string,
  status?: string,
): Promise<PortResult> {
  try {
    const connectors = await deps.registry.listConnectors({ category, status });
    const enriched = connectors.map((c: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      ...c,
      authConfig: undefined, // Never send credentials
      health: deps.engine.getHealthStatus(c.id),
    }));
    return ok(enriched);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function getConnector(
  deps: Pick<IntegrationHubDeps, "registry" | "engine">,
  connectorId: string,
): Promise<PortResult> {
  try {
    const connector = await deps.registry.getConnector(connectorId);
    if (!connector) return fail(404, "Connector not found");
    return ok({
      ...connector,
      authConfig: undefined,
      health: deps.engine.getHealthStatus((connector as any).id ?? connectorId), // eslint-disable-line @typescript-eslint/no-explicit-any
    });
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function createConnector(
  deps: Pick<IntegrationHubDeps, "registry">,
  userId: string | undefined,
  body: Record<string, unknown>,
): Promise<PortResult> {
  try {
    const connector = await deps.registry.createConnector(body, userId);
    return ok({ ...connector, authConfig: undefined });
  } catch (e) {
    return fail(400, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function createConnectorFromTemplate(
  deps: Pick<IntegrationHubDeps, "registry">,
  userId: string | undefined,
  body: { templateId?: string; baseUrl?: string; auth?: unknown; name?: string },
): Promise<PortResult> {
  try {
    if (!body.templateId) return fail(400, "templateId is required");
    const connector = await deps.registry.createFromTemplate(
      body.templateId,
      { baseUrl: body.baseUrl, auth: body.auth, name: body.name },
      userId,
    );
    return ok({ ...connector, authConfig: undefined });
  } catch (e) {
    return fail(400, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function getConnectorAuthorizationUrl(
  deps: Pick<IntegrationHubDeps, "registry">,
  connectorId: string,
  state?: string,
): Promise<PortResult> {
  try {
    return ok({ authorizationUrl: await deps.registry.getAuthorizationUrl(connectorId, state) });
  } catch (e) {
    return fail(400, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function completeConnectorAuthorizationCode(
  deps: Pick<IntegrationHubDeps, "registry">,
  connectorId: string,
  code: string,
): Promise<PortResult> {
  try {
    return ok(await deps.registry.completeAuthorizationCodeFlow(connectorId, code));
  } catch (e) {
    return fail(400, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function updateConnector(
  deps: Pick<IntegrationHubDeps, "registry">,
  connectorId: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  try {
    const connector = await deps.registry.updateConnector(connectorId, body);
    if (!connector) return fail(404, "Connector not found");
    return ok({ ...connector, authConfig: undefined });
  } catch (e) {
    return fail(400, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function deleteConnector(
  deps: Pick<IntegrationHubDeps, "registry">,
  connectorId: string,
): Promise<PortResult> {
  try {
    const deleted = await deps.registry.deleteConnector(connectorId);
    if (!deleted) return fail(404, "Connector not found");
    return ok(null, "Connector deleted");
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function toggleConnector(
  deps: Pick<IntegrationHubDeps, "registry">,
  connectorId: string,
  enabled: unknown,
): Promise<PortResult> {
  try {
    if (typeof enabled !== "boolean") return fail(400, "enabled must be boolean");
    const connector = await deps.registry.toggleConnector(connectorId, enabled);
    if (!connector) return fail(404, "Connector not found");
    return ok({
      id: (connector as any).id, // eslint-disable-line @typescript-eslint/no-explicit-any
      enabled: (connector as any).enabled, // eslint-disable-line @typescript-eslint/no-explicit-any
      status: (connector as any).status, // eslint-disable-line @typescript-eslint/no-explicit-any
    });
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function testConnection(
  deps: Pick<IntegrationHubDeps, "registry">,
  connectorId: string,
): Promise<PortResult> {
  try {
    const result = await deps.registry.testConnection(connectorId);
    return ok(result);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function executeConnectorRequest(
  deps: Pick<IntegrationHubDeps, "registry">,
  connectorId: string,
  userId: string | undefined,
  body: { endpointId?: string; params?: unknown; query?: unknown; body?: unknown; headers?: unknown },
): Promise<PortResult> {
  try {
    if (!body.endpointId) return fail(400, "endpointId is required");
    const response = await deps.registry.executeRequest(
      connectorId,
      { endpointId: body.endpointId, params: body.params, query: body.query, body: body.body, headers: body.headers },
      userId,
    );
    return ok(response);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function getConnectorLogs(
  deps: Pick<IntegrationHubDeps, "registry">,
  connectorId: string,
  limit: number = 50,
): Promise<PortResult> {
  try {
    const logs = await deps.registry.getExecutionLogs(connectorId, limit);
    return ok(logs);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function getConnectorStats(
  deps: Pick<IntegrationHubDeps, "registry">,
  connectorId: string,
): Promise<PortResult> {
  try {
    const stats = await deps.registry.getConnectorStats(connectorId);
    return ok(stats);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export function getHealthStatuses(
  deps: Pick<IntegrationHubDeps, "registry">,
): PortResult {
  return ok(deps.registry.getHealthStatuses());
}

export async function resetCircuitBreaker(
  deps: Pick<IntegrationHubDeps, "registry">,
  connectorId: string,
): Promise<PortResult> {
  try {
    await deps.registry.resetCircuitBreaker(connectorId);
    return ok(null, "Circuit breaker reset");
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function listWebhooks(
  deps: Pick<IntegrationHubDeps, "registry">,
  connectorId: string,
): Promise<PortResult> {
  try {
    const webhooks = await deps.registry.listWebhooks(connectorId);
    return ok(webhooks);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function createWebhook(
  deps: Pick<IntegrationHubDeps, "registry">,
  connectorId: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  try {
    const webhook = await deps.registry.createWebhook({ connectorId, ...body });
    return ok(webhook);
  } catch (e) {
    return fail(400, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function receiveWebhook(
  deps: Pick<IntegrationHubDeps, "engine">,
  webhookId: string,
  payload: unknown,
  headers: Record<string, unknown>,
): Promise<PortResult> {
  try {
    deps.engine.emit("webhook:received", {
      webhookId,
      payload: payload as Record<string, unknown>,
      headers,
      timestamp: new Date().toISOString(),
    });
    return ok(null, "Webhook received");
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}
