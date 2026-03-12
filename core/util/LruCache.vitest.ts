import { describe, expect, it, vi, beforeEach } from "vitest";
import { PrecalculatedLruCache } from "./LruCache";

describe("PrecalculatedLruCache", () => {
  let mockCalculateValue: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCalculateValue = vi.fn();
  });

  describe("initKey", () => {
    it("should calculate and store value for new key", async () => {
      mockCalculateValue.mockResolvedValue("calculated-value");
      const cache = new PrecalculatedLruCache(mockCalculateValue, 5);

      await cache.initKey("key1");

      expect(mockCalculateValue).toHaveBeenCalledWith("key1");
      expect(cache.get("key1")).toBe("calculated-value");
    });

    it("should not store value when calculation returns null", async () => {
      mockCalculateValue.mockResolvedValue(null);
      const cache = new PrecalculatedLruCache(mockCalculateValue, 5);

      await cache.initKey("key1");

      expect(mockCalculateValue).toHaveBeenCalledWith("key1");
      expect(cache.get("key1")).toBeUndefined();
    });

    it("should not recalculate for existing key", async () => {
      mockCalculateValue.mockResolvedValue("calculated-value");
      const cache = new PrecalculatedLruCache(mockCalculateValue, 5);

      await cache.initKey("key1");
      await cache.initKey("key1");

      expect(mockCalculateValue).toHaveBeenCalledTimes(1);
    });

    it("should maintain LRU order by moving accessed key to end", async () => {
      mockCalculateValue
        .mockResolvedValueOnce("value1")
        .mockResolvedValueOnce("value2")
        .mockResolvedValueOnce("value3");

      const cache = new PrecalculatedLruCache(mockCalculateValue, 3);

      await cache.initKey("key1");
      await cache.initKey("key2");
      await cache.initKey("key3");
      // Access key1 again to move it to the end
      await cache.initKey("key1");

      // All values should still be present
      expect(cache.get("key1")).toBe("value1");
      expect(cache.get("key2")).toBe("value2");
      expect(cache.get("key3")).toBe("value3");
    });

    it("should evict oldest key when capacity is exceeded", async () => {
      mockCalculateValue.mockImplementation(
        async (key: string) => `value-${key}`,
      );

      const cache = new PrecalculatedLruCache(mockCalculateValue, 3);

      await cache.initKey("key1");
      await cache.initKey("key2");
      await cache.initKey("key3");
      await cache.initKey("key4"); // This should evict key1

      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBe("value-key2");
      expect(cache.get("key3")).toBe("value-key3");
      expect(cache.get("key4")).toBe("value-key4");
    });

    it("should evict correct key after LRU reordering", async () => {
      mockCalculateValue.mockImplementation(
        async (key: string) => `value-${key}`,
      );

      const cache = new PrecalculatedLruCache(mockCalculateValue, 3);

      await cache.initKey("key1");
      await cache.initKey("key2");
      await cache.initKey("key3");
      // Access key1 to move it to end (LRU order now: key2, key3, key1)
      await cache.initKey("key1");
      // Add key4, should evict key2 (oldest)
      await cache.initKey("key4");

      expect(cache.get("key1")).toBe("value-key1");
      expect(cache.get("key2")).toBeUndefined();
      expect(cache.get("key3")).toBe("value-key3");
      expect(cache.get("key4")).toBe("value-key4");
    });

    it("should handle cache size of 1", async () => {
      mockCalculateValue.mockImplementation(
        async (key: string) => `value-${key}`,
      );

      const cache = new PrecalculatedLruCache(mockCalculateValue, 1);

      await cache.initKey("key1");
      expect(cache.get("key1")).toBe("value-key1");

      await cache.initKey("key2");
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBe("value-key2");
    });

    it("should handle async calculation errors", async () => {
      mockCalculateValue.mockRejectedValue(new Error("Calculation failed"));
      const cache = new PrecalculatedLruCache(mockCalculateValue, 5);

      await expect(cache.initKey("key1")).rejects.toThrow("Calculation failed");
    });
  });

  describe("get", () => {
    it("should return undefined for non-existent key", () => {
      const cache = new PrecalculatedLruCache(mockCalculateValue, 5);
      expect(cache.get("non-existent")).toBeUndefined();
    });

    it("should return stored value for existing key", async () => {
      mockCalculateValue.mockResolvedValue("test-value");
      const cache = new PrecalculatedLruCache(mockCalculateValue, 5);

      await cache.initKey("key1");

      expect(cache.get("key1")).toBe("test-value");
    });

    it("should return undefined for evicted key", async () => {
      mockCalculateValue.mockImplementation(
        async (key: string) => `value-${key}`,
      );
      const cache = new PrecalculatedLruCache(mockCalculateValue, 2);

      await cache.initKey("key1");
      await cache.initKey("key2");
      await cache.initKey("key3"); // Evicts key1

      expect(cache.get("key1")).toBeUndefined();
    });

    it("should work with different value types", async () => {
      const objectCache = new PrecalculatedLruCache<{ id: number }>(
        async (key) => ({ id: parseInt(key) }),
        5,
      );

      await objectCache.initKey("42");

      expect(objectCache.get("42")).toEqual({ id: 42 });
    });

    it("should work with array values", async () => {
      const arrayCache = new PrecalculatedLruCache<number[]>(
        async (key) => key.split(",").map(Number),
        5,
      );

      await arrayCache.initKey("1,2,3");

      expect(arrayCache.get("1,2,3")).toEqual([1, 2, 3]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string as key", async () => {
      mockCalculateValue.mockResolvedValue("empty-key-value");
      const cache = new PrecalculatedLruCache(mockCalculateValue, 5);

      await cache.initKey("");

      expect(cache.get("")).toBe("empty-key-value");
    });

    it("should handle keys with special characters", async () => {
      mockCalculateValue.mockImplementation(
        async (key: string) => `value-${key}`,
      );
      const cache = new PrecalculatedLruCache(mockCalculateValue, 5);

      const specialKeys = [
        "/path/to/file.ts",
        "key with spaces",
        "key\nwith\nnewlines",
        "key:with:colons",
      ];

      for (const key of specialKeys) {
        await cache.initKey(key);
      }

      for (const key of specialKeys) {
        expect(cache.get(key)).toBe(`value-${key}`);
      }
    });

    it("should handle rapid consecutive calls for same key", async () => {
      let callCount = 0;
      mockCalculateValue.mockImplementation(async () => {
        callCount++;
        return `value-${callCount}`;
      });

      const cache = new PrecalculatedLruCache(mockCalculateValue, 5);

      // Call initKey multiple times rapidly for the same key
      await Promise.all([
        cache.initKey("key1"),
        cache.initKey("key1"),
        cache.initKey("key1"),
      ]);

      // The first call calculates, subsequent calls just reorder
      // Note: Due to async nature, multiple calculations may occur
      expect(cache.get("key1")).toBeDefined();
    });
  });
});
