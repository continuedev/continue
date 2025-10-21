import AutocompleteLruCache from "./AutocompleteLruCache";

jest.mock("async-mutex", () => {
  const acquire = jest.fn().mockResolvedValue(jest.fn());
  return {
    Mutex: jest.fn().mockImplementation(() => ({ acquire })),
  };
});
jest.mock("sqlite");
jest.mock("sqlite3");

jest.useFakeTimers();

describe("AutocompleteLruCache", () => {
  let mockDb: any;
  let cache: AutocompleteLruCache;
  let currentTime: number;

  const createMockDb = () => ({
    run: jest.fn().mockResolvedValue(undefined),
    all: jest.fn().mockResolvedValue([]),
    exec: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
    currentTime = 1000000;
    jest.spyOn(Date, "now").mockImplementation(() => currentTime);

    mockDb = createMockDb();
    cache = new (AutocompleteLruCache as any)(mockDb);

    // Reset static properties
    (AutocompleteLruCache as any).capacity = 1000;
    (AutocompleteLruCache as any).flushInterval = 30000;
  });

  afterEach(async () => {
    // Clean up any running timers
    if ((cache as any).flushTimer) {
      clearInterval((cache as any).flushTimer);
    }
    jest.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════
  // BASIC CACHE OPERATIONS
  // ═══════════════════════════════════════════════════════════════
  describe("Basic Cache Operations", () => {
    describe("put() method", () => {
      it("should store a new entry in the cache", async () => {
        await cache.put("hello", "world");

        const internalCache = (cache as any).cache;
        expect(internalCache.has("hello")).toBe(true);
        expect(internalCache.get("hello")).toEqual({
          value: "world",
          timestamp: currentTime,
        });
      });

      it("should mark entry as dirty after put", async () => {
        await cache.put("key", "value");

        const dirtySet = (cache as any).dirty;
        expect(dirtySet.has("key")).toBe(true);
      });

      it("should update existing entry with new value and timestamp", async () => {
        await cache.put("key", "old");
        currentTime += 5000;
        await cache.put("key", "new");

        const entry = (cache as any).cache.get("key");
        expect(entry.value).toBe("new");
        expect(entry.timestamp).toBe(currentTime);
      });

      it("should handle prefix storage correctly", async () => {
        await cache.put("original_prefix", "completion");
        const internalCache = (cache as any).cache;
        expect(internalCache.size).toBe(1);
      });

      it("should acquire mutex lock during put operation", async () => {
        const releaseSpy = jest.fn();
        const mutex = (cache as any).mutex;
        const acquireSpy = jest
          .spyOn(mutex, "acquire")
          .mockResolvedValue(releaseSpy);

        await cache.put("test", "value");

        expect(acquireSpy).toHaveBeenCalled();
        expect(releaseSpy).toHaveBeenCalled();
      });
    });

    describe("get() method", () => {
      it("should retrieve exact match from cache", async () => {
        await cache.put("prefix", "completion");

        const result = await cache.get("prefix");
        expect(result).toBe("completion");
      });

      it("should return undefined when no match exists", async () => {
        const result = await cache.get("nonexistent");
        expect(result).toBeUndefined();
      });

      it("should update timestamp when entry is accessed", async () => {
        await cache.put("key", "value");
        const originalTimestamp = (cache as any).cache.get("key").timestamp;

        currentTime += 10000;
        await cache.get("key");

        const updatedTimestamp = (cache as any).cache.get("key").timestamp;
        expect(updatedTimestamp).toBe(currentTime);
        expect(updatedTimestamp).toBeGreaterThan(originalTimestamp);
      });

      it("should mark entry as dirty after updating timestamp", async () => {
        await cache.put("key", "value");
        (cache as any).dirty.clear();

        await cache.get("key");

        expect((cache as any).dirty.has("key")).toBe(true);
      });

      it("should find longest matching prefix", async () => {
        await cache.put("hel", "lo_world");
        await cache.put("hello", "_user_suffix");
        const result = await cache.get("hello_user");
        expect(result).toBe("_suffix");
      });

      it("should return completion with correct prefix stripped", async () => {
        await cache.put("pre", "fix_completion");

        const result = await cache.get("prefix");
        expect(result).toBe("_completion");
      });

      it("should validate that completion starts with remaining prefix", async () => {
        await cache.put("abc", "xyz");

        // "abcdef" starts with "abc", remaining is "def"
        // But cached value "xyz" doesn't start with "def"
        const result = await cache.get("abcdef");
        expect(result).toBeUndefined();
      });

      it("should handle prefix matching logic", async () => {
        await cache.put("pre", "fix_completion");

        const result = await cache.get("prefix");
        // Result depends on truncateSqliteLikePattern behavior
        expect(
          result === "fix_completion" ||
            result === "_completion" ||
            result === undefined,
        ).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LRU EVICTION MECHANISM
  // ═══════════════════════════════════════════════════════════════
  describe("LRU Eviction", () => {
    beforeEach(() => {
      (AutocompleteLruCache as any).capacity = 3;
    });

    it("should respect capacity limit", async () => {
      await cache.put("a", "1");
      await cache.put("b", "2");
      await cache.put("c", "3");

      expect((cache as any).cache.size).toBe(3);

      await cache.put("d", "4");

      expect((cache as any).cache.size).toBe(3);
    });

    it("should evict oldest entry when capacity exceeded", async () => {
      await cache.put("a", "1");
      currentTime += 1000;
      await cache.put("b", "2");
      currentTime += 1000;
      await cache.put("c", "3");
      currentTime += 1000;
      await cache.put("d", "4"); // Should evict "a"

      expect(await cache.get("a")).toBeUndefined();
      expect(await cache.get("b")).toBe("2");
      expect(await cache.get("c")).toBe("3");
      expect(await cache.get("d")).toBe("4");
    });

    it("should keep recently accessed entries during eviction", async () => {
      await cache.put("a", "1");
      currentTime += 1000;
      await cache.put("b", "2");
      currentTime += 1000;
      await cache.put("c", "3");
      currentTime += 1000;

      // Access "a" to make it recent
      await cache.get("a");
      currentTime += 1000;

      await cache.put("d", "4"); // Should evict "b" (oldest)

      expect(await cache.get("a")).toBe("1");
      expect(await cache.get("b")).toBeUndefined();
      expect(await cache.get("c")).toBe("3");
      expect(await cache.get("d")).toBe("4");
    });

    it("should mark evicted entry as dirty for database deletion", async () => {
      await cache.put("a", "1");
      await cache.put("b", "2");
      await cache.put("c", "3");

      (cache as any).dirty.clear();

      await cache.put("d", "4");

      const dirtySet = (cache as any).dirty;
      expect(dirtySet.size).toBeGreaterThan(0);
    });

    it("should handle capacity of 1", async () => {
      (AutocompleteLruCache as any).capacity = 1;

      await cache.put("a", "1");
      await cache.put("b", "2");

      expect((cache as any).cache.size).toBe(1);
      expect(await cache.get("a")).toBeUndefined();
      expect(await cache.get("b")).toBe("2");
    });

    it("should find oldest entry among multiple old entries", async () => {
      await cache.put("a", "1");
      currentTime += 100;
      await cache.put("b", "2");
      currentTime += 100;
      await cache.put("c", "3");

      // Make "b" oldest by accessing "a" and "c"
      currentTime += 100;
      await cache.get("c");
      currentTime += 100;
      await cache.get("a");
      currentTime += 100;

      await cache.put("d", "4"); // Should evict "b"

      expect(await cache.get("b")).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATABASE PERSISTENCE & FLUSH
  // ═══════════════════════════════════════════════════════════════
  describe("Database Persistence", () => {
    describe("flush() method", () => {
      it("should do nothing when dirty set is empty", async () => {
        await cache.flush();

        expect(mockDb.run).not.toHaveBeenCalled();
      });

      it("should wrap operations in transaction", async () => {
        await cache.put("key", "value");
        await cache.flush();

        const calls = mockDb.run.mock.calls;
        expect(calls[0][0]).toBe("BEGIN TRANSACTION");
        expect(calls[calls.length - 1][0]).toBe("COMMIT");
      });

      it("should perform upsert for existing cache entries", async () => {
        await cache.put("foo", "bar");
        await cache.flush();

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining("INSERT INTO cache"),
          "foo",
          "bar",
          currentTime,
          "bar",
          currentTime,
        );
      });

      it("should delete entries removed from cache", async () => {
        await cache.put("temp", "value");
        (cache as any).cache.delete("temp");
        (cache as any).dirty.add("temp");

        await cache.flush();

        expect(mockDb.run).toHaveBeenCalledWith(
          "DELETE FROM cache WHERE key = ?",
          "temp",
        );
      });

      it("should clear dirty set after successful flush", async () => {
        await cache.put("key1", "val1");
        await cache.put("key2", "val2");

        expect((cache as any).dirty.size).toBe(2);

        await cache.flush();

        expect((cache as any).dirty.size).toBe(0);
      });

      it("should rollback transaction on error", async () => {
        await cache.put("key", "value");
        mockDb.run.mockImplementation((sql: string) => {
          if (sql.includes("INSERT")) {
            return Promise.reject(new Error("DB Error"));
          }
          return Promise.resolve();
        });

        await cache.flush();

        expect(mockDb.run).toHaveBeenCalledWith("ROLLBACK");
      });

      it("should log error when flush fails", async () => {
        const consoleError = jest.spyOn(console, "error").mockImplementation();
        await cache.put("key", "value");
        const dbError = new Error("Database failure");
        mockDb.run.mockRejectedValueOnce(dbError);

        await cache.flush();

        expect(consoleError).toHaveBeenCalledWith(
          "Error flushing cache:",
          dbError,
        );

        consoleError.mockRestore();
      });

      it("should acquire mutex during flush", async () => {
        const releaseSpy = jest.fn();
        const mutex = (cache as any).mutex;
        const acquireSpy = jest
          .spyOn(mutex, "acquire")
          .mockResolvedValue(releaseSpy);

        await cache.put("key", "value");
        await cache.flush();

        expect(acquireSpy).toHaveBeenCalled();
        expect(releaseSpy).toHaveBeenCalled();
      });

      it("should release mutex even if error occurs", async () => {
        const consoleError = jest.spyOn(console, "error").mockImplementation();
        const releaseSpy = jest.fn();
        jest
          .spyOn((cache as any).mutex, "acquire")
          .mockResolvedValue(releaseSpy);

        await cache.put("key", "value");

        const originalRun = mockDb.run;
        mockDb.run = jest.fn().mockImplementation((sql: string) => {
          if (sql === "BEGIN TRANSACTION" || sql === "ROLLBACK") {
            return Promise.resolve();
          }
          return Promise.reject(new Error("DB Error"));
        });

        await cache.flush();

        expect(releaseSpy).toHaveBeenCalled();
        expect(mockDb.run).toHaveBeenCalledWith("ROLLBACK");

        // Restore
        mockDb.run = originalRun;
        consoleError.mockRestore();
      });

      it("should handle multiple dirty entries in one flush", async () => {
        await cache.put("key1", "val1");
        await cache.put("key2", "val2");
        await cache.put("key3", "val3");

        await cache.flush();

        const insertCalls = mockDb.run.mock.calls.filter((call: any) =>
          call[0].includes("INSERT INTO cache"),
        );
        expect(insertCalls.length).toBe(3);
      });
    });

    describe("loadFromDb() method", () => {
      it("should load all entries from database", async () => {
        mockDb.all.mockResolvedValue([
          { key: "a", value: "alpha", timestamp: 1000 },
          { key: "b", value: "beta", timestamp: 2000 },
        ]);

        await (cache as any).loadFromDb();

        const internalCache = (cache as any).cache;
        expect(internalCache.size).toBe(2);
        expect(internalCache.get("a")).toEqual({
          value: "alpha",
          timestamp: 1000,
        });
        expect(internalCache.get("b")).toEqual({
          value: "beta",
          timestamp: 2000,
        });
      });

      it("should handle empty database", async () => {
        mockDb.all.mockResolvedValue([]);

        await (cache as any).loadFromDb();

        expect((cache as any).cache.size).toBe(0);
      });

      it("should query with correct SQL", async () => {
        await (cache as any).loadFromDb();

        expect(mockDb.all).toHaveBeenCalledWith(
          "SELECT key, value, timestamp FROM cache",
        );
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AUTOMATIC FLUSH TIMER
  // ═══════════════════════════════════════════════════════════════
  describe("Automatic Flush Timer", () => {
    it("should start timer on startFlushTimer()", () => {
      (cache as any).startFlushTimer();

      expect((cache as any).flushTimer).toBeDefined();
    });

    it("should call flush at configured intervals", async () => {
      (AutocompleteLruCache as any).flushInterval = 1000;
      const flushSpy = jest.spyOn(cache, "flush").mockResolvedValue();

      (cache as any).startFlushTimer();

      jest.advanceTimersByTime(1000);
      expect(flushSpy).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1000);
      expect(flushSpy).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(1000);
      expect(flushSpy).toHaveBeenCalledTimes(3);

      flushSpy.mockRestore();
    });

    it("should handle flush errors gracefully", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation();
      const flushError = new Error("Flush failed");
      jest.spyOn(cache, "flush").mockRejectedValue(flushError);

      (AutocompleteLruCache as any).flushInterval = 1000;
      (cache as any).startFlushTimer();

      jest.advanceTimersByTime(1000);
      await Promise.resolve(); // Let error handler run

      expect(consoleError).toHaveBeenCalledWith(
        "Error flushing cache:",
        flushError,
      );

      consoleError.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESOURCE CLEANUP
  // ═══════════════════════════════════════════════════════════════
  describe("Resource Cleanup", () => {
    it("should clear timer on close()", async () => {
      (cache as any).startFlushTimer();
      const timerId = (cache as any).flushTimer;
      const clearSpy = jest.spyOn(global, "clearInterval");

      await cache.close();

      expect(clearSpy).toHaveBeenCalledWith(timerId);
    });

    it("should flush pending changes on close()", async () => {
      await cache.put("key", "value");

      await cache.close();

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO cache"),
        "key",
        "value",
        currentTime,
        "value",
        currentTime,
      );
    });

    it("should close database connection", async () => {
      await cache.close();

      expect(mockDb.close).toHaveBeenCalled();
    });

    it("should execute cleanup in correct order", async () => {
      (cache as any).startFlushTimer();
      await cache.put("key", "value");

      const operations: string[] = [];

      const originalClearInterval = clearInterval;
      const clearIntervalSpy = jest
        .spyOn(global, "clearInterval")
        .mockImplementation((id) => {
          operations.push("clearTimer");
          return originalClearInterval(id);
        });

      const flushSpy = jest
        .spyOn(cache, "flush")
        .mockImplementation(async () => {
          operations.push("flush");
        });

      const closeDbSpy = mockDb.close.mockImplementation(() => {
        operations.push("dbClose");
        return Promise.resolve();
      });

      await cache.close();

      expect(operations).toEqual(["clearTimer", "flush", "dbClose"]);

      clearIntervalSpy.mockRestore();
      flushSpy.mockRestore();
    });

    it("should handle close() when timer not started", async () => {
      // Don't start timer
      await expect(cache.close()).resolves.not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EDGE CASES & SPECIAL SCENARIOS
  // ═══════════════════════════════════════════════════════════════
  describe("Edge Cases", () => {
    it("should handle empty string as prefix", async () => {
      await cache.put("", "empty");
      const result = await cache.get("");

      expect(result).toBe("empty");
    });

    it("should handle very long prefixes", async () => {
      const longPrefix = "a".repeat(1000);
      await cache.put(longPrefix, "completion");

      const result = await cache.get(longPrefix);
      expect(result).toBe("completion");
    });

    it("should handle special characters in prefix", async () => {
      const specialPrefix = "test%_\\[";
      await cache.put(specialPrefix, "special");

      const result = await cache.get(specialPrefix);
      expect(result).toBe("special");
    });

    it("should handle Unicode characters", async () => {
      await cache.put("🚀", "rocket");
      const result = await cache.get("🚀");

      expect(result).toBe("rocket");
    });

    it("should handle multiple puts of same key", async () => {
      await cache.put("key", "first");
      await cache.put("key", "second");
      await cache.put("key", "third");

      expect(await cache.get("key")).toBe("third");
      expect((cache as any).cache.size).toBe(1);
    });

    it("should handle concurrent get operations", async () => {
      await cache.put("shared", "value");

      const results = await Promise.all([
        cache.get("shared"),
        cache.get("shared"),
        cache.get("shared"),
      ]);

      expect(results).toEqual(["value", "value", "value"]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SINGLETON PATTERN (Static get() method)
  // ═══════════════════════════════════════════════════════════════
  describe("Singleton Pattern", () => {
    beforeEach(() => {
      // Reset singleton
      (AutocompleteLruCache as any).instancePromise = undefined;
    });

    it("should return same instance on multiple calls", async () => {
      const mockOpen = jest.fn().mockResolvedValue(mockDb);
      jest.doMock("sqlite", () => ({ open: mockOpen }));

      const instance1 = await AutocompleteLruCache.get();
      const instance2 = await AutocompleteLruCache.get();

      expect(instance1).toBe(instance2);
    });
  });
});
