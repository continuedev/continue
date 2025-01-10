class ClipboardCache {
  private cache: Map<string, string>;
  private order: string[];
  private readonly maxSize = 30;

  constructor() {
    this.cache = new Map();
    this.order = [];
  }

  add(id: string, content: string): void {
    if (!content) {
      return;
    }
    if (this.order.length >= this.maxSize) {
      const oldest = this.order.pop();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(id, content);
    this.order.unshift(id);
  }

  getNItems(count: number): {
    id: string;
    content: string;
  }[] {
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
