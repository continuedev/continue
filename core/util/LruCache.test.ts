import { PrecalculatedLruCache } from "./LruCache";

describe("PrecalculatedLruCache", () => {
  const N = 2;

  let calculateValue: jest.MockedFunction<(key: string) => Promise<number>>;
  let cache: PrecalculatedLruCache<number>;

  beforeEach(() => {
    calculateValue = jest.fn(async (key: string) => {
      return parseInt(key, 10) * 2;
    });

    cache = new PrecalculatedLruCache<number>(calculateValue, N);
  });

  it("should calculate and cache values", async () => {
    await cache.initKey("1");
    expect(calculateValue).toHaveBeenCalledWith("1");
    expect(cache.get("1")).toBe(2);
  });

  it("should not recalculate cached values", async () => {
    await cache.initKey("1");
    calculateValue.mockClear();

    await cache.initKey("1");
    expect(calculateValue).not.toHaveBeenCalled();
    expect(cache.get("1")).toBe(2);
  });

  it("should evict least recently used items when capacity is exceeded", async () => {
    await cache.initKey("1");
    await cache.initKey("2");
    await cache.initKey("3"); // Exceeds capacity, should evict "1"

    expect(cache.get("1")).toBeUndefined();
    expect(cache.get("2")).toBe(4);
    expect(cache.get("3")).toBe(6);
  });

  it("should update LRU order when keys are accessed", async () => {
    await cache.initKey("1");
    await cache.initKey("2");

    // Access "1" to make it most recently used
    await cache.initKey("1");
    await cache.initKey("3"); // Exceeds capacity, should evict "2"

    expect(cache.get("1")).toBe(2);
    expect(cache.get("2")).toBeUndefined();
    expect(cache.get("3")).toBe(6);
  });

  it("should handle get for keys not initialized", () => {
    expect(cache.get("not-initialized")).toBeUndefined();
  });

  it("should propagate errors from calculateValue", async () => {
    calculateValue.mockRejectedValue(new Error("Calculation failed"));
    await expect(cache.initKey("error")).rejects.toThrow("Calculation failed");
    expect(cache.get("error")).toBeUndefined();
  });
});
