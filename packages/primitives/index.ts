/**
 * Shared Primitives — Framework-agnostic helpers used by both client and server.
 *
 * Must NOT import Express, React, database, or any domain-specific module.
 * Only pure utility types, parsers, and branded IDs belong here.
 */

export * from "./ids";
export * from "./result";
export * from "./dates";
export * from "./enums";
export * from "./events";
export * from "./valueObjects";
