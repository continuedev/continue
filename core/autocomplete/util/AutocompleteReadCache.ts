import { IDE } from "../..";
import { LRUCache } from "lru-cache";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_ENTRIES = 100;

/**
 * LRU cache for file reads during autocomplete to avoid redundant I/O.
 * Files are cached by URI with a short TTL so stale content is evicted.
 */
export class AutocompleteReadCache {
  private static cache = new LRUCache<string, string>({
    max: CACHE_MAX_ENTRIES,
    ttl: CACHE_TTL_MS,
  });

  /**
   * Read a file, returning a cached result if available.
   */
  static async read(ide: IDE, fileUri: string): Promise<string> {
    const cached = this.cache.get(fileUri);
    if (cached !== undefined) {
      return cached;
    }

    const contents = await ide.readFile(fileUri);
    this.cache.set(fileUri, contents);
    return contents;
  }

  /**
   * Invalidate a specific file from the cache.
   */
  static invalidate(fileUri: string): void {
    this.cache.delete(fileUri);
  }

  /**
   * Clear the entire cache.
   */
  static clear(): void {
    this.cache.clear();
  }
}
