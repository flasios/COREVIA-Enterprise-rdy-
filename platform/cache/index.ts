/**
 * Platform Cache — In-memory LRU cache with TTL.
 *
 * Drop-in cache layer for modules that need short-lived memoization
 * without requiring an external store.  When Redis is available, swap
 * this implementation for a Redis-backed adapter that implements the
 * same CachePort interface.
 *
 * No domain logic — purely infrastructure.
 */

// ── Port (interface modules program against) ──────────────────────────

export interface CachePort {
  get<T = unknown>(key: string): T | undefined;
  set<T = unknown>(key: string, value: T, ttlMs?: number): void;
  del(key: string): boolean;
  has(key: string): boolean;
  clear(): void;
  size(): number;
}

// ── In-memory implementation ──────────────────────────────────────────

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number; // epoch ms, 0 = never
}

export class MemoryCache implements CachePort {
  private readonly store = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(opts?: { maxEntries?: number; defaultTtlMs?: number }) {
    this.maxEntries = opts?.maxEntries ?? 2_000;
    this.defaultTtlMs = opts?.defaultTtlMs ?? 5 * 60_000; // 5 min
  }

  get<T = unknown>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T = unknown>(key: string, value: T, ttlMs?: number): void {
    // Evict oldest if at capacity
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    const ttl = ttlMs ?? this.defaultTtlMs;
    this.store.set(key, {
      value,
      expiresAt: ttl > 0 ? Date.now() + ttl : 0,
    });
  }

  del(key: string): boolean {
    return this.store.delete(key);
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

/** Default application-wide cache instance. */
export const appCache: CachePort = new MemoryCache();
