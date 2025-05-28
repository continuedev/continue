export class DiffSnippetsCache {
  private static instance: DiffSnippetsCache;
  private cache: Map<number, any> = new Map();
  private lastTimestamp: number = 0;

  private constructor() {}

  public static getInstance(): DiffSnippetsCache {
    if (!DiffSnippetsCache.instance) {
      DiffSnippetsCache.instance = new DiffSnippetsCache();
    }
    return DiffSnippetsCache.instance;
  }

  public set<T>(timestamp: number, value: T): T {
    // Clear old cache entry if exists
    if (this.lastTimestamp !== timestamp) {
      this.cache.clear();
    }
    this.lastTimestamp = timestamp;
    this.cache.set(timestamp, value);
    return value;
  }

  public get(timestamp: number): any | undefined {
    return this.cache.get(timestamp);
  }
}
