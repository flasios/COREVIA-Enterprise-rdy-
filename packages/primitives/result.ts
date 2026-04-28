/**
 * Result / Either Pattern — Domain-safe error handling without exceptions.
 *
 * Use Result<T, E> as return type for operations that can fail.
 * Eliminates thrown exceptions in domain/application layers.
 *
 * Usage:
 *   function parseConfig(raw: string): Result<Config, "INVALID_JSON" | "MISSING_FIELD"> {
 *     try {
 *       const data = JSON.parse(raw);
 *       if (!data.name) return Err("MISSING_FIELD");
 *       return Ok({ name: data.name });
 *     } catch {
 *       return Err("INVALID_JSON");
 *     }
 *   }
 */

export type Result<T, E = string> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E = string> {
  readonly ok: false;
  readonly error: E;
}

export function Ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function Err<E = string>(error: E): Err<E> {
  return { ok: false, error };
}

/** Unwrap a Result — throws if Err */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`Unwrap failed: ${String(result.error)}`);
  return result.value;
}

/** Map over the success case */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? Ok(fn(result.value)) : result;
}

/** Map over the error case */
export function mapError<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : Err(fn(result.error));
}

/** Chain Results (flatMap) */
export function flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}
