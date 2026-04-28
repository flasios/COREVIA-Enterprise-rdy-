/**
 * JSON Column Typing Utilities
 *
 * Drizzle ORM JSON/JSONB columns return `unknown` at runtime.
 * These helpers provide type-safe access patterns that avoid `as any`.
 *
 * Usage:
 *   import { jsonField, jsonAs } from "@platform/typing/jsonColumn";
 *
 *   // Instead of: (row.metadata as any)?.key
 *   jsonField(row.metadata, "key")        // unknown
 *   jsonField<string>(row.metadata, "key") // string | undefined
 *
 *   // Instead of: row.config as any
 *   jsonAs<MyConfig>(row.config)           // MyConfig
 */

/**
 * Safely access a field from a JSON column value.
 * Returns `undefined` if the value is not an object or the field doesn't exist.
 */
export function jsonField<T = unknown>(
  json: unknown,
  key: string,
): T | undefined {
  if (json != null && typeof json === "object" && key in json) {
    return (json as Record<string, unknown>)[key] as T;
  }
  return undefined;
}

/**
 * Cast a JSON column to a known shape.
 * Preferred over `as any` — makes the target type explicit and grep-able.
 */
export function jsonAs<T>(json: unknown): T {
  return json as T;
}

/**
 * Safely access nested JSON column data with a fallback.
 */
export function jsonFieldOr<T>(
  json: unknown,
  key: string,
  fallback: T,
): T {
  const val = jsonField<T>(json, key);
  return val ?? fallback;
}
