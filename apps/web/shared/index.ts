/**
 * Client Shared Barrel
 *
 * Single import surface for all cross-module shared utilities:
 *
 *   import { httpJson, cn, useToast } from "@/shared";
 *
 * Domain-specific code should NOT be placed here.
 */

export * from "./services";
export * from "./hooks";
export * from "./types";
export * from "./lib";
