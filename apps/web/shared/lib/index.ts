/**
 * Shared · Lib
 *
 * Cross-module utilities with NO domain logic.
 * Domain utilities belong in `modules/<domain>/hooks/` or `domain/`.
 */

export { cn } from "./utils";
export { queryClient, getQueryFn } from "./queryClient";
export * from "./schemas";
export * from "./brain-utils";
