import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  data: unknown;
  timestamp: number;
  etag: string;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 500;
const DEFAULT_TTL = 60000; // 60 seconds

function generateETag(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `"${hash.toString(16)}"`;
}

function getCacheKey(req: Request): string {
  const userId = (req.session as any)?.userId || 'anonymous'; // eslint-disable-line @typescript-eslint/no-explicit-any
  return `${req.method}:${req.originalUrl}:${userId}`;
}

function cleanupOldEntries() {
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, entries.length - MAX_CACHE_SIZE + 50);
    toDelete.forEach(([key]) => cache.delete(key));
  }
}

export function apiCache(ttlMs: number = DEFAULT_TTL) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = getCacheKey(req);
    const cached = cache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < ttlMs) {
      const clientEtag = req.headers['if-none-match'];
      if (clientEtag === cached.etag) {
        return res.status(304).end();
      }
      res.setHeader('ETag', cached.etag);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `private, max-age=${Math.floor(ttlMs / 1000)}`);
      return res.json(cached.data);
    }

    const originalJson = res.json.bind(res);
    res.json = (data: unknown) => {
      if (res.statusCode === 200) {
        const etag = generateETag(data);
        cache.set(cacheKey, { data, timestamp: now, etag });
        res.setHeader('ETag', etag);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', `private, max-age=${Math.floor(ttlMs / 1000)}`);
        cleanupOldEntries();
      }
      return originalJson(data);
    };

    next();
  };
}

export function invalidateCache(pattern?: string) {
  if (!pattern) {
    cache.clear();
    return;
  }
  
  const keys = Array.from(cache.keys());
  for (const key of keys) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

export function getCacheStats() {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    keys: Array.from(cache.keys()).slice(0, 20)
  };
}
