import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import RedisStore from "connect-redis";
import Redis from "ioredis";
import { pool } from "../../../platform/db";
import { logger } from "../../../platform/observability";

const PgStore = connectPgSimple(session);

const redisExplicitlyEnabled = process.env.ENABLE_REDIS === "true";
const redisConfigPresent = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
const useRedisSessionStore = redisExplicitlyEnabled && redisConfigPresent;

if (!redisExplicitlyEnabled && redisConfigPresent) {
  logger.info("[Redis] Redis configuration detected but disabled (set ENABLE_REDIS=true to enable)");
}

function buildPgSessionStore(): session.Store {
  return new PgStore({
    pool,
    tableName: "session",
    createTableIfMissing: true,
  });
}

function buildRedisSessionClient(): Redis | null {
  if (!useRedisSessionStore) {
    return null;
  }

  const redisOptions = {
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    retryStrategy: (times: number) => (times <= 2 ? Math.min(times * 200, 500) : null),
  };

  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, redisOptions);
  }

  return new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    ...redisOptions,
  });
}

export async function buildSessionStore(): Promise<session.Store> {
  const redisClient = buildRedisSessionClient();
  if (!redisClient) {
    return buildPgSessionStore();
  }

  let lastRedisError = 0;
  redisClient.on("error", (err) => {
    const now = Date.now();
    if (now - lastRedisError > 60_000) {
      logger.error("[Redis] Client error (throttled, next log in 60s):", {
        error: err instanceof Error ? (err.message || err.name) : String(err),
      });
      lastRedisError = now;
    }
  });

  try {
    await redisClient.connect();
    await redisClient.ping();
    logger.info("[Redis] Session store connected");
    return new RedisStore({ client: redisClient, prefix: "corevia:sess:" });
  } catch (error) {
    logger.warn("[Redis] Session store unavailable; falling back to PostgreSQL", {
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    redisClient.disconnect();
    return buildPgSessionStore();
  }
}