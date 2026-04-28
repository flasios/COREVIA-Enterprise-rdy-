/**
 * Operations Module — Application Layer
 *
 * Use-cases and orchestration logic.
 * Transaction boundaries live here.
 *
 * Allowed imports: ./domain, shared/contracts, platform abstractions.
 */
export * from "./buildDeps";
export * from "./shared";
export * from "./notifications.useCases";
export * from "./teams.useCases";
export * from "./users.useCases";
export * from "./cache.useCases";
