import { beforeEach, expect, test, vi } from "vitest";
import { GitDiffCache } from "./gitDiffCache";

beforeEach(() => {
  // Add this line to GitDiffCache class to make instance accessible
  (GitDiffCache as any).instance = null;
});

test("GitDiffCache returns cached results within cache time", async () => {
  const mockDiff = ["file1.ts", "file2.ts"];
  const getDiffFn = vi.fn().mockResolvedValue(mockDiff);
  const cache = GitDiffCache.getInstance(getDiffFn, 1); // 1 second cache

  const result1 = await cache.get();
  const result2 = await cache.get();

  expect(result1).toEqual(mockDiff);
  expect(result2).toEqual(mockDiff);
  expect(getDiffFn).toHaveBeenCalledTimes(1);
});

test("GitDiffCache refreshes cache after expiration", async () => {
  const mockDiff = ["file1.ts"];
  const getDiffFn = vi.fn().mockResolvedValue(mockDiff);
  const cache = GitDiffCache.getInstance(getDiffFn, 0.1); // 100ms cache

  const result1 = await cache.get();
  await new Promise((resolve) => setTimeout(resolve, 200)); // Wait for cache to expire
  const result2 = await cache.get();

  expect(getDiffFn).toHaveBeenCalledTimes(2);
});

test("GitDiffCache returns empty array on error", async () => {
  const getDiffFn = vi.fn().mockRejectedValue(new Error("Git error"));
  const cache = GitDiffCache.getInstance(getDiffFn);

  const result = await cache.get();
  expect(result).toEqual([]);
});

test("GitDiffCache reuses pending request", async () => {
  const mockDiff = ["file1.ts"];
  let resolvePromise: (value: string[]) => void;
  const getDiffFn = vi.fn().mockImplementation(() => {
    return new Promise((resolve) => {
      resolvePromise = resolve;
    });
  });

  const cache = GitDiffCache.getInstance(getDiffFn);

  const promise1 = cache.get();
  const promise2 = cache.get();

  resolvePromise!(mockDiff);

  const [result1, result2] = await Promise.all([promise1, promise2]);

  expect(result1).toEqual(mockDiff);
  expect(result2).toEqual(mockDiff);
  expect(getDiffFn).toHaveBeenCalledTimes(1);
});

test("GitDiffCache invalidate clears cache", async () => {
  const mockDiff = ["file1.ts"];
  const getDiffFn = vi.fn().mockResolvedValue(mockDiff);
  const cache = GitDiffCache.getInstance(getDiffFn);

  await cache.get();
  cache.invalidate();
  await cache.get();

  expect(getDiffFn).toHaveBeenCalledTimes(2);
});

test("GitDiffCache maintains singleton instance", () => {
  const getDiffFn1 = vi.fn();
  const getDiffFn2 = vi.fn();

  const instance1 = GitDiffCache.getInstance(getDiffFn1);
  const instance2 = GitDiffCache.getInstance(getDiffFn2);

  expect(instance1).toBe(instance2);
});
