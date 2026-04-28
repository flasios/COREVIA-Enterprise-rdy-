/**
 * Integration Module — Public API surface.
 *
 * Covers external system connectors and the Integration Hub.
 */

// ── API ───────────────────────────────────────────────────────────────
export {
  fetchConnectors,
  fetchConnectorStatus,
  toggleConnector,
} from "./api/integrationApi";
