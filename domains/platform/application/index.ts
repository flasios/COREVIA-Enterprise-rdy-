/**
 * Platform Module — Application Layer
 *
 * Re-exports infrastructure adapters for use by API routes.
 */
export { checkDatabaseHealth } from "../infrastructure/databaseHealthChecker";
export type { DatabaseHealthResult } from "../infrastructure/databaseHealthChecker";
