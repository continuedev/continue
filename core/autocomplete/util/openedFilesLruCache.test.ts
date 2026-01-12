import { openedFilesLruCache, updateCacheSize } from "./openedFilesLruCache";

describe("openedFilesLruCache", () => {
  beforeEach(() => {
    openedFilesLruCache.clear();
    // Reset to default (though we test resizing explicitly)
    updateCacheSize(50);
  });

  test("should resize down and evict overflow", () => {
    updateCacheSize(5);
    openedFilesLruCache.set("A", "A");
    openedFilesLruCache.set("B", "B");
    openedFilesLruCache.set("C", "C");

    expect(openedFilesLruCache.size).toBe(3);

    // Resize down to 2
    updateCacheSize(2);

    expect(openedFilesLruCache.size).toBe(2);
    expect(openedFilesLruCache.has("A")).toBe(false);
    expect(openedFilesLruCache.has("B")).toBe(true);
    expect(openedFilesLruCache.has("C")).toBe(true);
  });

  test("should resize up and preserve items", () => {
    updateCacheSize(2);
    openedFilesLruCache.set("A", "A");
    openedFilesLruCache.set("B", "B");

    // Resize up
    updateCacheSize(5);
    openedFilesLruCache.set("C", "C");
    openedFilesLruCache.set("D", "D");
    openedFilesLruCache.set("E", "E");

    expect(openedFilesLruCache.size).toBe(5);
    expect(openedFilesLruCache.has("A")).toBe(true);
  });
});
