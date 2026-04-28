/**
 * Cache — Unit Tests
 *
 * Tests the MemoryCache implementation of CachePort.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryCache } from "../index";

describe("MemoryCache", () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache({ defaultTtlMs: 0 }); // no default TTL for basic tests
  });

  describe("get/set", () => {
    it("returns undefined for missing key", () => {
      expect(cache.get("missing")).toBeUndefined();
    });

    it("stores and retrieves a value", () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("stores objects", () => {
      const obj = { foo: "bar", count: 42 };
      cache.set("obj", obj);
      expect(cache.get("obj")).toEqual(obj);
    });

    it("overwrites existing values", () => {
      cache.set("key", "old");
      cache.set("key", "new");
      expect(cache.get("key")).toBe("new");
    });
  });

  describe("has", () => {
    it("returns false for missing key", () => {
      expect(cache.has("missing")).toBe(false);
    });

    it("returns true for existing key", () => {
      cache.set("exists", 1);
      expect(cache.has("exists")).toBe(true);
    });
  });

  describe("del", () => {
    it("removes an existing key", () => {
      cache.set("key", "value");
      cache.del("key");
      expect(cache.has("key")).toBe(false);
      expect(cache.get("key")).toBeUndefined();
    });

    it("returns false for missing key", () => {
      expect(cache.del("missing")).toBe(false);
    });

    it("returns true when key existed", () => {
      cache.set("key", "value");
      expect(cache.del("key")).toBe(true);
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      cache.clear();
      expect(cache.has("a")).toBe(false);
      expect(cache.has("b")).toBe(false);
      expect(cache.has("c")).toBe(false);
      expect(cache.size()).toBe(0);
    });
  });

  describe("size", () => {
    it("starts at 0", () => {
      expect(cache.size()).toBe(0);
    });

    it("increases with new entries", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      expect(cache.size()).toBe(2);
    });

    it("does not increase on overwrite", () => {
      cache.set("a", 1);
      cache.set("a", 2);
      expect(cache.size()).toBe(1);
    });

    it("decreases on del", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.del("a");
      expect(cache.size()).toBe(1);
    });
  });

  describe("TTL expiration", () => {
    it("expires entries after TTL", () => {
      vi.useFakeTimers();
      const ttlCache = new MemoryCache({ defaultTtlMs: 0 });

      // Set with 100ms TTL
      ttlCache.set("temp", "data", 100);
      expect(ttlCache.get("temp")).toBe("data");

      // Advance time past TTL
      vi.advanceTimersByTime(150);
      expect(ttlCache.get("temp")).toBeUndefined();

      vi.useRealTimers();
    });

    it("does not expire entries with 0 TTL", () => {
      vi.useFakeTimers();
      const noTtlCache = new MemoryCache({ defaultTtlMs: 0 });

      noTtlCache.set("permanent", "data"); // ttl = 0 (never expires)
      vi.advanceTimersByTime(60_000);
      expect(noTtlCache.get("permanent")).toBe("data");

      vi.useRealTimers();
    });
  });

  describe("max entries eviction", () => {
    it("evicts oldest entry when at capacity", () => {
      const smallCache = new MemoryCache({ maxEntries: 3, defaultTtlMs: 0 });
      smallCache.set("a", 1);
      smallCache.set("b", 2);
      smallCache.set("c", 3);
      // Adding 4th should evict "a"
      smallCache.set("d", 4);
      expect(smallCache.has("a")).toBe(false);
      expect(smallCache.get("d")).toBe(4);
      expect(smallCache.size()).toBe(3);
    });
  });
});
