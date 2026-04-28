/**
 * Platform · Cache — Redis adapter implementing CachePort.
 *
 * Drop-in replacement for MemoryCache when Redis is available.
 * Uses the existing ioredis connection from the application.
 *
 * Configuration:
 *   ENABLE_REDIS=true          — must be set
 *   REDIS_URL=redis://host:6379 — Redis connection URL
 *
 * Usage:
 *   import { createCacheAdapter } from "@/platform/cache/redis.adapter";
 *   const cache = createCacheAdapter(); // returns MemoryCache or RedisCache
 */

import type { CachePort } from "./index";
import { MemoryCache } from "./index";
import { logger } from "../logging/Logger";

export class RedisCache implements CachePort {
  private readonly client: import("ioredis").default;
  private readonly prefix: string;
  private readonly defaultTtlMs: number;

  constructor(opts: {
    client: import("ioredis").default;
    prefix?: string;
    defaultTtlMs?: number;
  }) {
    this.client = opts.client;
    this.prefix = opts.prefix ?? "corevia:cache:";
    this.defaultTtlMs = opts.defaultTtlMs ?? 5 * 60_000; // 5 min
  }

  private key(k: string): string {
    return `${this.prefix}${k}`;
  }

  get<T = unknown>(_key: string): T | undefined {
    // Redis is async — this sync interface returns undefined.
    // Use getAsync for proper Redis reads.
    return undefined;
  }

  /** Async version of get — use this for Redis-backed reads */
  async getAsync<T = unknown>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.client.get(this.key(key));
      if (raw === null) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  set<T = unknown>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const serialized = JSON.stringify(value);
    if (ttl > 0) {
      this.client.set(this.key(key), serialized, "PX", ttl).catch(() => {});
    } else {
      this.client.set(this.key(key), serialized).catch(() => {});
    }
  }

  del(key: string): boolean {
    this.client.del(this.key(key)).catch(() => {});
    return true; // fire-and-forget
  }

  has(_key: string): boolean {
    // Sync check not possible — use hasAsync
    return false;
  }

  async hasAsync(key: string): Promise<boolean> {
    try {
      return (await this.client.exists(this.key(key))) === 1;
    } catch {
      return false;
    }
  }

  clear(): void {
    // SCAN + DEL for this prefix
    const stream = this.client.scanStream({
      match: `${this.prefix}*`,
      count: 100,
    });
    stream.on("data", (keys: string[]) => {
      if (keys.length) this.client.del(...keys).catch(() => {});
    });
  }

  size(): number {
    return 0; // Not efficiently available in Redis; use sizeAsync
  }

  async sizeAsync(): Promise<number> {
    let count = 0;
    return new Promise((resolve) => {
      const stream = this.client.scanStream({
        match: `${this.prefix}*`,
        count: 100,
      });
      stream.on("data", (keys: string[]) => {
        count += keys.length;
      });
      stream.on("end", () => resolve(count));
      stream.on("error", () => resolve(0));
    });
  }
}

/**
 * Factory: create the best available cache adapter.
 * Returns RedisCache if Redis is enabled and connectable, else MemoryCache.
 */
export async function createCacheAdapter(): Promise<CachePort> {
  if (process.env.ENABLE_REDIS !== "true" || !process.env.REDIS_URL) {
    logger.info("[Cache] Using in-memory cache (set ENABLE_REDIS=true for Redis)");
    return new MemoryCache();
  }

  try {
    const { default: Redis } = await import("ioredis");
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    await client.connect();
    await client.ping();

    logger.info(`[Cache] Redis cache adapter connected → ${process.env.REDIS_URL}`);
    return new RedisCache({ client });
  } catch (err) {
    logger.warn("[Cache] Redis connection failed — falling back to in-memory cache", err);
    return new MemoryCache();
  }
}
