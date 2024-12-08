import { LRUCache } from "lru-cache";

/**
 * A cache that stores promises. If a promise is requested and it's already in
 * the cache, the promise is returned. If it's not in the cache, the promise is
 * created, stored in the cache, and then returned.
 *
 * Set the max size to the number of cache entries you would like to store, based on memory consumption.
 * Set the ttl value to the number of milliseconds you would like to keep the cache entry, based on how long you expect the data to be valid.
 */

export class LRUAsyncCache {
  private cache: LRUCache<string, Promise<any>>;

  constructor(options: LRUCache.Options<string, any, unknown>) {
    this.cache = new LRUCache<string, Promise<any>>(options);
  }

  async get<T>(
    key: string,
    create: () => Promise<T>,
    onCached: undefined | (() => void) = undefined,
  ): Promise<T> {
    let value = this.cache.get(key);
    if (!value) {
      value = create();
      this.cache.set(key, value);
    } else {
      onCached?.();
    }
    return value;
  }
}
