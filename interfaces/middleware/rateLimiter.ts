import rateLimit, { MemoryStore, ipKeyGenerator, type Store } from 'express-rate-limit';
import type { Request, Response } from 'express';
import Redis from 'ioredis';
import { logger } from '../../platform/observability';

const redisExplicitlyEnabled = process.env.ENABLE_REDIS === 'true';
const redisConfigPresent = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);

class RedisRateLimitStore implements Store {
  windowMs = 60_000;
  localKeys = false;
  prefix: string;

  constructor(
    private readonly client: Redis,
    prefix: string,
  ) {
    this.prefix = prefix;
  }

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  private key(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string) {
    const storeKey = this.key(key);
    const results = await this.client.multi().get(storeKey).pttl(storeKey).exec();
    if (!results) {
      throw new Error('Redis rate-limit store failed to read state');
    }

    const rawHits = results[0]?.[1];
    const rawTtl = results[1]?.[1];
    if (rawHits === null || rawHits === undefined) {
      return undefined;
    }

    const totalHits = Number(rawHits);
    const ttl = Math.max(Number(rawTtl), 0);
    return {
      totalHits,
      resetTime: new Date(Date.now() + ttl),
    };
  }

  async increment(key: string) {
    const storeKey = this.key(key);
    const results = await this.client.multi().incr(storeKey).pttl(storeKey).exec();
    if (!results) {
      throw new Error('Redis rate-limit store failed to increment state');
    }

    const totalHits = Number(results[0]?.[1] ?? 0);
    let ttl = Number(results[1]?.[1] ?? -1);

    if (ttl <= 0) {
      await this.client.pexpire(storeKey, this.windowMs);
      ttl = this.windowMs;
    }

    return {
      totalHits,
      resetTime: new Date(Date.now() + ttl),
    };
  }

  async decrement(key: string) {
    const storeKey = this.key(key);
    const totalHits = await this.client.decr(storeKey);
    if (totalHits <= 0) {
      await this.client.del(storeKey);
    }
  }

  async resetKey(key: string) {
    await this.client.del(this.key(key));
  }

  async resetAll() {
    const stream = this.client.scanStream({
      match: `${this.prefix}*`,
      count: 100,
    });

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (keys: string[]) => {
        if (keys.length > 0) {
          void this.client.del(...keys);
        }
      });
      stream.on('end', () => resolve());
      stream.on('error', (error) => reject(error));
    });
  }
}

let sharedRedisRateLimitClient: Redis | null = null;
let loggedRedisFallback = false;

function buildRedisRateLimitClient(): Redis | null {
  if (!redisExplicitlyEnabled || !redisConfigPresent) {
    return null;
  }

  const redisOptions = {
    lazyConnect: false,
    enableOfflineQueue: false,
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    retryStrategy: (times: number) => (times <= 2 ? Math.min(times * 200, 500) : null),
  };

  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, redisOptions);
  }

  return new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    ...redisOptions,
  });
}

function getRateLimitStore(prefix: string): Store {
  if (!sharedRedisRateLimitClient) {
    sharedRedisRateLimitClient = buildRedisRateLimitClient();

    if (sharedRedisRateLimitClient) {
      sharedRedisRateLimitClient.on('error', (error) => {
        logger.warn('[RateLimiter] Redis store error', {
          metadata: { error: error instanceof Error ? error.message : String(error) },
        });
      });
    }
  }

  if (!sharedRedisRateLimitClient) {
    if (!loggedRedisFallback && redisConfigPresent && !redisExplicitlyEnabled) {
      logger.info('[RateLimiter] Redis configuration detected but disabled; using in-memory limiter store');
      loggedRedisFallback = true;
    }
    return new MemoryStore();
  }

  return new RedisRateLimitStore(sharedRedisRateLimitClient, prefix);
}

function getClientKey(req: Request, _res: Response): string {
  const userId = (req as any).auth?.userId; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (userId) return `user:${userId}`;
  return ipKeyGenerator(req.ip ?? "unknown");
}

function sanitizeRateLimitPath(value: string): string {
  return value.replace(/[^a-zA-Z0-9:/_-]/g, '').slice(0, 160);
}

function getAiClientKey(req: Request, res: Response): string {
  const identity = getClientKey(req, res);
  const routeKey = sanitizeRateLimitPath(`${req.baseUrl || ''}${req.path || ''}`) || 'unknown-route';
  return `${identity}:ai:${routeKey}`;
}

function normalizeAuthIdentity(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized.slice(0, 128) : null;
}

function getAuthAttemptKey(req: Request): string {
  const ipKey = ipKeyGenerator(req.ip ?? "unknown");
  const email = normalizeAuthIdentity((req.body as any)?.email); // eslint-disable-line @typescript-eslint/no-explicit-any
  const username = normalizeAuthIdentity((req.body as any)?.username); // eslint-disable-line @typescript-eslint/no-explicit-any
  const identity = email ?? username ?? "anonymous";
  return `auth:${ipKey}:${identity}`;
}

function getPositiveIntEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.floor(parsedValue);
}

const authRateLimitStore = getRateLimitStore('corevia:rate-limit:auth:');
const authRateLimitWindowMs = getPositiveIntEnv('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
const authRateLimitMax = getPositiveIntEnv('AUTH_RATE_LIMIT_MAX', 10);

async function resetAuthAttemptLimit(req: Request): Promise<void> {
  await authRateLimitStore.resetKey(getAuthAttemptKey(req));
}

const trustProxy = process.env.TRUST_PROXY === 'true';
const standardRateLimitMax = getPositiveIntEnv('STANDARD_RATE_LIMIT_MAX', 100);
const aiRateLimitWindowMs = getPositiveIntEnv('AI_RATE_LIMIT_WINDOW_MS', 60 * 1000);
const aiRateLimitMax = getPositiveIntEnv('AI_RATE_LIMIT_MAX', process.env.NODE_ENV === 'development' ? 300 : 60);

const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: standardRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: getRateLimitStore('corevia:rate-limit:standard:'),
  message: { success: false, error: 'Too many requests, please try again later.' },
  keyGenerator: getClientKey,
  skip: (req: Request) => {
    // Skip rate limiting in development mode or when explicitly bypassed for local environments
    if (process.env.NODE_ENV === 'development' || process.env.RATE_LIMIT_SKIP === 'true') return true;
    return req.path === '/api/health' || req.path === '/api/csp-report' || req.path.startsWith('/assets');
  },
  validate: { xForwardedForHeader: trustProxy },
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: getRateLimitStore('corevia:rate-limit:strict:'),
  message: { success: false, error: 'Rate limit exceeded for this operation.' },
  keyGenerator: getClientKey,
  validate: { xForwardedForHeader: trustProxy },
});

const authLimiter = rateLimit({
  windowMs: authRateLimitWindowMs,
  max: authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: authRateLimitStore,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
  keyGenerator: (req: Request) => getAuthAttemptKey(req),
  skipSuccessfulRequests: true,
  validate: { xForwardedForHeader: trustProxy },
  skip: () => process.env.NODE_ENV === 'development',
});

const aiLimiter = rateLimit({
  windowMs: aiRateLimitWindowMs,
  max: aiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: getRateLimitStore('corevia:rate-limit:ai:'),
  message: { success: false, error: 'AI service rate limit exceeded. Please wait before making more requests.' },
  keyGenerator: getAiClientKey,
  validate: { xForwardedForHeader: trustProxy },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  store: getRateLimitStore('corevia:rate-limit:upload:'),
  message: { success: false, error: 'Upload rate limit exceeded. Please try again later.' },
  keyGenerator: getClientKey,
  validate: { xForwardedForHeader: trustProxy },
});

export { standardLimiter, strictLimiter, authLimiter, aiLimiter, uploadLimiter, resetAuthAttemptLimit };
