import { LRUCache } from "lru-cache";
import * as URI from "uri-js";

const MAX_READ_CACHE_SIZE = 100;
type ReadFn = (uri: string) => Promise<string>;
export class AutocompleteReadCache {
  private static _instance: AutocompleteReadCache | null = null;
  private cache: LRUCache<string, string>;

  constructor(private readonly readFile: ReadFn) {
    this.cache = new LRUCache({
      max: MAX_READ_CACHE_SIZE,
      ttl: 5 * 60 * 1000, // 5 minutes in milliseconds
      updateAgeOnGet: true,
    });
  }

  static getInstance(readFile: ReadFn): AutocompleteReadCache {
    if (!AutocompleteReadCache._instance) {
      AutocompleteReadCache._instance = new AutocompleteReadCache(readFile);
    }
    return AutocompleteReadCache._instance;
  }

  get(uri: string): string | undefined {
    return this.cache.get(URI.normalize(uri));
  }

  set(uri: string, contents: string): void {
    this.cache.set(URI.normalize(uri), contents);
  }

  delete(uri: string): boolean {
    return this.cache.delete(URI.normalize(uri));
  }

  has(uri: string): boolean {
    return this.cache.has(URI.normalize(uri));
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  async getOrRead(uri: string): Promise<string> {
    const normalizedUri = URI.normalize(uri);
    const cached = this.cache.get(normalizedUri);
    if (cached !== undefined) {
      return cached;
    }
    console.log(`read file - Autocomplete read cache - ${normalizedUri}`);

    const contents = await this.readFile(normalizedUri);
    this.cache.set(normalizedUri, contents);
    return contents;
  }

  invalidate(uri: string): void {
    this.cache.delete(URI.normalize(uri));
  }
}
