/**
 * Integration Module — Application Layer: Dependency Wiring
 *
 * Constructs adapter instances for each route group.
 * API routes import from here instead of infrastructure directly.
 */
import type {
  ConnectorRegistryPort,
  ConnectorEnginePort,
  ConnectorCategoriesProvider,
} from "../domain/ports";

import {
  LegacyConnectorRegistry,
  LegacyConnectorEngine,
  LegacyConnectorCategories,
} from "../infrastructure/adapters";

/* ─── Integration Hub deps ──────────────────────────────────── */

export interface IntegrationHubDeps {
  registry: ConnectorRegistryPort;
  engine: ConnectorEnginePort;
  categories: ConnectorCategoriesProvider;
}

export function buildIntegrationHubDeps(): IntegrationHubDeps {
  return {
    registry: new LegacyConnectorRegistry(),
    engine: new LegacyConnectorEngine(),
    categories: new LegacyConnectorCategories(),
  };
}
