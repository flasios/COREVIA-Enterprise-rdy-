import type { PresenceTracker } from "../domain/ports";
import { getVersionPresence } from "@interfaces/websocket";

/**
 * Wraps getVersionPresence from websocket module behind the PresenceTracker port.
 */
export class WebSocketPresenceTracker implements PresenceTracker {
  getVersionPresence(versionId: string): { viewers: Array<Record<string, unknown>>; editors: Array<Record<string, unknown>>; [key: string]: unknown } {
    return getVersionPresence(versionId) as unknown as ReturnType<PresenceTracker["getVersionPresence"]>;
  }
}
