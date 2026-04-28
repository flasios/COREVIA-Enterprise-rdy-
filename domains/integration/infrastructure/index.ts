/**
 * Integration Module — Infrastructure Layer
 *
 * DB repositories and external adapters for connectors.
 * Implements ports defined in ../domain/.
 */
export {
  LegacyConnectorRegistry,
  LegacyConnectorEngine,
  LegacyConnectorCategories,
} from "./adapters";
export * from "./connectorEngine";
export * from "./connectorRegistry";
export * from "./connectorTemplates";
