import { createHash } from 'node:crypto';

interface CacheEntry<T> {
	data: T;
	timestamp: number;
	expiresAt: number;
}

export class AICache {
	private readonly cache = new Map<string, CacheEntry<unknown>>();
	private readonly maxSize: number;
	private readonly defaultTtlMs: number;
	private hitCount = 0;
	private missCount = 0;

	constructor(maxSize = 1000, defaultTtlMs = 60 * 60 * 1000) {
		this.maxSize = maxSize;
		this.defaultTtlMs = defaultTtlMs;

		setInterval(() => this.cleanup(), 10 * 60 * 1000);
	}

	private generateKey(method: string, ...params: unknown[]): string {
		const input = JSON.stringify({ method, params });
		return createHash('sha256').update(input, 'utf8').digest('hex');
	}

	set<T>(method: string, params: unknown[], value: T, ttlMs?: number): void {
		const key = this.generateKey(method, ...params);
		const now = Date.now();
		const ttl = ttlMs || this.defaultTtlMs;

		if (this.cache.has(key)) {
			this.cache.delete(key);
		}

		if (this.cache.size >= this.maxSize) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey) {
				this.cache.delete(oldestKey);
			}
		}

		this.cache.set(key, {
			data: value,
			timestamp: now,
			expiresAt: now + ttl,
		});
	}

	get<T>(method: string, ...params: unknown[]): T | null {
		const key = this.generateKey(method, ...params);
		const entry = this.cache.get(key);

		if (!entry) {
			this.missCount++;
			return null;
		}

		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			this.missCount++;
			return null;
		}

		this.cache.delete(key);
		this.cache.set(key, entry);

		this.hitCount++;
		return entry.data as T;
	}

	has(method: string, ...params: unknown[]): boolean {
		return this.get(method, ...params) !== null;
	}

	clear(): void {
		this.cache.clear();
		this.hitCount = 0;
		this.missCount = 0;
	}

	private cleanup(): void {
		const now = Date.now();
		const entries = Array.from(this.cache.entries());
		for (const [key, entry] of entries) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
			}
		}
	}

	getStats() {
		const now = Date.now();
		let expiredCount = 0;

		const values = Array.from(this.cache.values());
		for (const entry of values) {
			if (now > entry.expiresAt) {
				expiredCount++;
			}
		}

		const totalRequests = this.hitCount + this.missCount;
		const hitRate = totalRequests > 0 ? ((this.hitCount / totalRequests) * 100).toFixed(2) + '%' : '0%';

		return {
			totalEntries: this.cache.size,
			activeEntries: this.cache.size - expiredCount,
			expiredEntries: expiredCount,
			maxSize: this.maxSize,
			hitCount: this.hitCount,
			missCount: this.missCount,
			totalRequests,
			hitRate,
			memoryUsage: `${(this.cache.size / this.maxSize * 100).toFixed(1)}%`,
		};
	}
}

export const aiCache = new AICache();
export type { CacheEntry };
