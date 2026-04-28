/**
 * SQL Column Name Sanitisation
 *
 * Prevents SQL injection via dynamic column names passed to sql.raw().
 * Only lowercase letters, digits, and underscores are allowed —
 * matching valid PostgreSQL identifiers without quoting.
 */

const SAFE_COLUMN_RE = /^[a-z][a-z0-9_]{0,62}$/;

/**
 * Assert that `name` is a safe SQL identifier (column name).
 * Throws if the name contains anything other than `[a-z0-9_]`.
 */
export function assertSafeColumnName(name: string): string {
  if (!SAFE_COLUMN_RE.test(name)) {
    throw new Error(`Unsafe SQL column name rejected: "${name}"`);
  }
  return name;
}

/**
 * Convert a camelCase JS key to a snake_case column name,
 * then validate it against the safe-identifier pattern.
 */
export function toSafeSnakeColumn(key: string): string {
  const snake = key.replace(/([A-Z])/g, "_$1").toLowerCase();
  return assertSafeColumnName(snake);
}
