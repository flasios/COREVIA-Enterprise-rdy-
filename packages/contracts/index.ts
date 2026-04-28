/**
 * Shared Contracts — Zod schemas and DTOs shared between client and server.
 *
 * These are the single source of truth for API request/response shapes.
 * Client API clients and server route handlers both import from here.
 *
 * Rules:
 *   - No React imports.
 *   - No Express imports.
 *   - Only Zod + shared primitives allowed as dependencies.
 */

export * from "./pagination";
export * from "./demand";
export * from "./portfolio";
export * from "./knowledge";
export * from "./identity";
export * from "./brain";
export * from "./notifications";
export * from "./enterprise-architecture";
