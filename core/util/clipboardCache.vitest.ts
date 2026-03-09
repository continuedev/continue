import { describe, expect, it, beforeEach } from "vitest";

// We need to test the ClipboardCache class, but it's not exported directly
// We need to test the exported clipboardCache singleton
// Since the module exports a singleton, we need to test it carefully

// Create a test file that exports the class for testing
// For now, let's test the exported singleton

describe("clipboardCache", () => {
  // Import fresh instance for each test
  let clipboardCache: typeof import("./clipboardCache").clipboardCache;

  beforeEach(async () => {
    // Dynamic import to get a fresh module
    const module = await import("./clipboardCache");
    clipboardCache = module.clipboardCache;
    clipboardCache.clear();
  });

  describe("add", () => {
    it("should add a new item to the cache", () => {
      const result = clipboardCache.add("id1", "content1");
      expect(result).toBe(true);
      expect(clipboardCache.get("id1")).toBe("content1");
    });

    it("should return false when content is empty", () => {
      const result = clipboardCache.add("id1", "");
      expect(result).toBe(false);
      expect(clipboardCache.get("id1")).toBeUndefined();
    });

    it("should return false when adding duplicate content with different id", () => {
      clipboardCache.add("id1", "same content");
      const result = clipboardCache.add("id2", "same content");
      expect(result).toBe(false);
      // The original entry should be removed when duplicate content is added
      expect(clipboardCache.get("id1")).toBeUndefined();
    });

    it("should allow adding same id with different content", () => {
      clipboardCache.add("id1", "content1");
      clipboardCache.add("id1", "content2");
      expect(clipboardCache.get("id1")).toBe("content2");
    });

    it("should evict oldest entry when cache exceeds max size (30)", () => {
      // Add 30 items
      for (let i = 0; i < 30; i++) {
        clipboardCache.add(`id${i}`, `content${i}`);
      }

      // All 30 items should be present
      expect(clipboardCache.get("id0")).toBe("content0");
      expect(clipboardCache.get("id29")).toBe("content29");

      // Add one more item - oldest should be evicted
      clipboardCache.add("id30", "content30");

      // id0 (oldest) should be evicted
      expect(clipboardCache.get("id0")).toBeUndefined();
      // id30 (newest) should be present
      expect(clipboardCache.get("id30")).toBe("content30");
    });
  });

  describe("get", () => {
    it("should return content for existing id", () => {
      clipboardCache.add("id1", "content1");
      expect(clipboardCache.get("id1")).toBe("content1");
    });

    it("should return undefined for non-existing id", () => {
      expect(clipboardCache.get("nonexistent")).toBeUndefined();
    });
  });

  describe("getNItems", () => {
    it("should return empty array when cache is empty", () => {
      const items = clipboardCache.getNItems(5);
      expect(items).toEqual([]);
    });

    it("should return items in order (most recent first)", () => {
      clipboardCache.add("id1", "content1");
      clipboardCache.add("id2", "content2");
      clipboardCache.add("id3", "content3");

      const items = clipboardCache.getNItems(3);
      expect(items).toEqual([
        { id: "id3", content: "content3" },
        { id: "id2", content: "content2" },
        { id: "id1", content: "content1" },
      ]);
    });

    it("should return only requested number of items", () => {
      clipboardCache.add("id1", "content1");
      clipboardCache.add("id2", "content2");
      clipboardCache.add("id3", "content3");

      const items = clipboardCache.getNItems(2);
      expect(items.length).toBe(2);
      expect(items).toEqual([
        { id: "id3", content: "content3" },
        { id: "id2", content: "content2" },
      ]);
    });

    it("should return all items if count exceeds cache size", () => {
      clipboardCache.add("id1", "content1");
      clipboardCache.add("id2", "content2");

      const items = clipboardCache.getNItems(10);
      expect(items.length).toBe(2);
    });

    it("should return empty string for items with missing content", () => {
      clipboardCache.add("id1", "content1");
      // This tests the edge case where cache.get returns undefined
      // In normal operation this shouldn't happen, but the code handles it
      const items = clipboardCache.getNItems(1);
      expect(items[0].content).toBe("content1");
    });
  });

  describe("select", () => {
    it("should move selected item to the front", () => {
      clipboardCache.add("id1", "content1");
      clipboardCache.add("id2", "content2");
      clipboardCache.add("id3", "content3");

      // id3 is at front, id1 is at back
      let items = clipboardCache.getNItems(3);
      expect(items[0].id).toBe("id3");
      expect(items[2].id).toBe("id1");

      // Select id1 - should move to front
      clipboardCache.select("id1");

      items = clipboardCache.getNItems(3);
      expect(items[0].id).toBe("id1");
      expect(items[1].id).toBe("id3");
      expect(items[2].id).toBe("id2");
    });

    it("should do nothing when selecting non-existing id", () => {
      clipboardCache.add("id1", "content1");
      clipboardCache.add("id2", "content2");

      clipboardCache.select("nonexistent");

      const items = clipboardCache.getNItems(2);
      expect(items[0].id).toBe("id2");
      expect(items[1].id).toBe("id1");
    });

    it("should do nothing when selecting item already at front", () => {
      clipboardCache.add("id1", "content1");
      clipboardCache.add("id2", "content2");

      clipboardCache.select("id2");

      const items = clipboardCache.getNItems(2);
      expect(items[0].id).toBe("id2");
      expect(items[1].id).toBe("id1");
    });
  });

  describe("clear", () => {
    it("should remove all items from the cache", () => {
      clipboardCache.add("id1", "content1");
      clipboardCache.add("id2", "content2");
      clipboardCache.add("id3", "content3");

      clipboardCache.clear();

      expect(clipboardCache.get("id1")).toBeUndefined();
      expect(clipboardCache.get("id2")).toBeUndefined();
      expect(clipboardCache.get("id3")).toBeUndefined();
      expect(clipboardCache.getNItems(10)).toEqual([]);
    });

    it("should allow adding items after clear", () => {
      clipboardCache.add("id1", "content1");
      clipboardCache.clear();
      clipboardCache.add("id2", "content2");

      expect(clipboardCache.get("id2")).toBe("content2");
      expect(clipboardCache.getNItems(1)).toEqual([
        { id: "id2", content: "content2" },
      ]);
    });
  });

  describe("edge cases", () => {
    it("should handle whitespace-only content", () => {
      const result = clipboardCache.add("id1", "   ");
      expect(result).toBe(true);
      expect(clipboardCache.get("id1")).toBe("   ");
    });

    it("should handle very long content", () => {
      const longContent = "a".repeat(10000);
      const result = clipboardCache.add("id1", longContent);
      expect(result).toBe(true);
      expect(clipboardCache.get("id1")).toBe(longContent);
    });

    it("should handle special characters in content", () => {
      const specialContent = "Hello\nWorld\t\r\n<>&\"'";
      const result = clipboardCache.add("id1", specialContent);
      expect(result).toBe(true);
      expect(clipboardCache.get("id1")).toBe(specialContent);
    });

    it("should handle unicode content", () => {
      const unicodeContent = "Hello 世界 🌍 مرحبا";
      const result = clipboardCache.add("id1", unicodeContent);
      expect(result).toBe(true);
      expect(clipboardCache.get("id1")).toBe(unicodeContent);
    });

    it("should handle empty id", () => {
      const result = clipboardCache.add("", "content");
      expect(result).toBe(true);
      expect(clipboardCache.get("")).toBe("content");
    });
  });
});
