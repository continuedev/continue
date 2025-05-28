import { DiffSnippetsCache } from "./diffSnippetCache";

test("DiffSnippetsCache getInstance returns singleton instance", () => {
  const instance1 = DiffSnippetsCache.getInstance();
  const instance2 = DiffSnippetsCache.getInstance();
  expect(instance1).toBe(instance2);
});

test("DiffSnippetsCache set stores value and returns it", () => {
  const cache = DiffSnippetsCache.getInstance();
  const timestamp = Date.now();
  const value = { test: "data" };

  const result = cache.set(timestamp, value);
  expect(result).toBe(value);
  expect(cache.get(timestamp)).toBe(value);
});

test("DiffSnippetsCache get returns undefined for non-existent timestamp", () => {
  const cache = DiffSnippetsCache.getInstance();
  const timestamp = Date.now();

  expect(cache.get(timestamp + 1000)).toBeUndefined();
});

test("DiffSnippetsCache set clears cache when timestamp changes", () => {
  const cache = DiffSnippetsCache.getInstance();
  const timestamp1 = Date.now();
  const timestamp2 = timestamp1 + 1000;
  const value1 = { test: "data1" };
  const value2 = { test: "data2" };

  cache.set(timestamp1, value1);
  cache.set(timestamp2, value2);

  expect(cache.get(timestamp1)).toBeUndefined();
  expect(cache.get(timestamp2)).toBe(value2);
});

test("DiffSnippetsCache set maintains cache with same timestamp", () => {
  const cache = DiffSnippetsCache.getInstance();
  const timestamp = Date.now();
  const value1 = { test: "data1" };
  const value2 = { test: "data2" };

  cache.set(timestamp, value1);
  cache.set(timestamp, value2);

  expect(cache.get(timestamp)).toBe(value2);
});
