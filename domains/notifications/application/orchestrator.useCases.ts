import type { OrchestratorDeps } from "./buildDeps";
import { type PortResult, ok, fail } from "./shared";


// ═══════════════════════════════════════════════════════════════════
//  NOTIFICATION-ORCHESTRATOR USE-CASES
// ═══════════════════════════════════════════════════════════════════

export async function getChannelsGrouped(
  deps: Pick<OrchestratorDeps, "orchestrator">,
): Promise<PortResult> {
  try {
    const grouped = await deps.orchestrator.getChannelsGrouped();
    const all = await deps.orchestrator.getChannels();
    const enabledCount = all.filter(c => c.enabled).length;
    return ok({
      channels: grouped,
      summary: {
        total: all.length,
        enabled: enabledCount,
        disabled: all.length - enabledCount,
        categories: Object.keys(grouped),
      },
    });
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function getChannelsFlat(
  deps: Pick<OrchestratorDeps, "orchestrator">,
): Promise<PortResult> {
  try {
    const channels = await deps.orchestrator.getChannels();
    return ok(channels);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function getChannel(
  deps: Pick<OrchestratorDeps, "orchestrator">,
  channelId: string,
): Promise<PortResult> {
  try {
    const channel = await deps.orchestrator.getChannel(channelId);
    if (!channel) return fail(404, "Channel not found");
    return ok(channel);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function toggleNotificationChannel(
  deps: Pick<OrchestratorDeps, "orchestrator">,
  channelId: string,
  enabled: unknown,
): Promise<PortResult> {
  try {
    if (typeof enabled !== "boolean") return fail(400, "enabled must be a boolean");
    const updated = await deps.orchestrator.toggleChannel(channelId, enabled);
    if (!updated) return fail(404, "Channel not found");
    return ok(updated);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function updateChannelConfig(
  deps: Pick<OrchestratorDeps, "orchestrator">,
  channelId: string,
  body: { deliveryMethods?: unknown; priority?: unknown; config?: unknown },
): Promise<PortResult> {
  try {
    const updated = await deps.orchestrator.updateChannelConfig(channelId, {
      deliveryMethods: body.deliveryMethods,
      priority: body.priority,
      config: body.config,
    } as Record<string, unknown>);
    if (!updated) return fail(404, "Channel not found");
    return ok(updated);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function bulkToggleChannels(
  deps: Pick<OrchestratorDeps, "orchestrator">,
  channelIds: unknown,
  enabled: unknown,
): Promise<PortResult> {
  try {
    if (!Array.isArray(channelIds) || typeof enabled !== "boolean") {
      return fail(400, "channelIds (array) and enabled (boolean) required");
    }
    const results = await Promise.all(
      channelIds.map((id: string) => deps.orchestrator.toggleChannel(id, enabled)),
    );
    return ok({ updated: results.filter(Boolean).length, total: channelIds.length });
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function registerChannel(
  deps: Pick<OrchestratorDeps, "orchestrator">,
  body: Record<string, unknown>,
): Promise<PortResult> {
  try {
    const { id, serviceName, category, name, description } = body as Record<string, string>;
    if (!id || !serviceName || !category || !name || !description) {
      return fail(400, "id, serviceName, category, name, description required");
    }
    const channel = await deps.orchestrator.registerChannel(body);
    return ok(channel);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function getChannelStats(
  deps: Pick<OrchestratorDeps, "orchestrator">,
): Promise<PortResult> {
  try {
    const stats = await deps.orchestrator.getChannelStats();
    return ok(stats);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function getUserPreferences(
  deps: Pick<OrchestratorDeps, "orchestrator">,
  userId: string,
): Promise<PortResult> {
  try {
    const prefs = await deps.orchestrator.getUserPreferences(userId);
    return ok(prefs);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function setUserPreference(
  deps: Pick<OrchestratorDeps, "orchestrator">,
  userId: string,
  channelId: string,
  body: { enabled?: unknown; deliveryMethods?: unknown; config?: unknown },
): Promise<PortResult> {
  try {
    await deps.orchestrator.setUserPreference(userId, channelId, body as Record<string, unknown>);
    return ok(null);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function emitNotification(
  deps: Pick<OrchestratorDeps, "orchestrator">,
  body: Record<string, unknown>,
): Promise<PortResult> {
  try {
    const { channelId, userId, title, message } = body as Record<string, string>;
    if (!channelId || !userId || !title || !message) {
      return fail(400, "channelId, userId, title, message required");
    }
    const sent = await deps.orchestrator.emit(body);
    return ok({ delivered: sent });
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function getWhatsAppStatus(
  deps: Pick<OrchestratorDeps, "whatsApp">,
): Promise<PortResult> {
  try {
    return ok(await deps.whatsApp.getStatus());
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function getWhatsAppConfig(
  deps: Pick<OrchestratorDeps, "whatsAppConfig">,
): Promise<PortResult> {
  try {
    const config = await deps.whatsAppConfig.getLatestConfig();
    return ok(config);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}

export async function updateWhatsAppConfig(
  deps: Pick<OrchestratorDeps, "whatsApp">,
  userId: string | null,
  body: Record<string, unknown>,
): Promise<PortResult> {
  try {
    await deps.whatsApp.updateConfigDb(body, userId);
    return ok(null);
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Unexpected error");
  }
}
