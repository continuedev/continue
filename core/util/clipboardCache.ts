class ClipboardCache {
  private cache: Map<string, string>;
  private order: string[];
  private readonly maxSize = 30;

  constructor() {
    this.cache = new Map();
    this.order = [];
  }

  /*
  Returns true if added, false if not.
  */
  add(id: string, content: string): boolean {
    if (!content) {
      return false;
    }

    // Check if the content already exists in the cache
    for (const [existingId, existingContent] of this.cache.entries()) {
      if (existingContent === content) {
        // Remove the existing entry with the same content
        this.cache.delete(existingId);
        const index = this.order.indexOf(existingId);
        if (index > -1) {
          this.order.splice(index, 1);
        }
        return false;
      }
    }

    // Remove the oldest entry if the cache exceeds the maximum size
    if (this.order.length >= this.maxSize) {
      const oldest = this.order.pop();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    // Add the new entry to the cache and update the order
    this.cache.set(id, content);
    this.order.unshift(id);
    return true;
  }

  getNItems(count: number): { id: string; content: string }[] {
    return this.order.slice(0, count).map((id) => ({
      id,
      content: this.cache.get(id) || "",
    }));
  }

  get(id: string): string | undefined {
    return this.cache.get(id);
  }

  select(id: string): void {
    const index = this.order.indexOf(id);
    if (index > -1) {
      this.order.splice(index, 1);
      this.order.unshift(id);
    }
  }

  clear(): void {
    this.cache.clear();
    this.order = [];
  }
}

export const clipboardCache = new ClipboardCache();
