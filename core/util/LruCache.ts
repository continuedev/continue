export class PrecalculatedLruCache<V> {
  private items: [string, V][] = [];
  constructor(
    private readonly calculateValue: (key: string) => Promise<V>,
    private readonly N: number,
  ) {}

  async initKey(key: string) {
    // Maintain LRU
    const index = this.items.findIndex((item) => item[0] === key);

    if (index < 0) {
      // Calculate info for new file
      const value: V = await this.calculateValue(key);

      this.items.push([key, value]);
      if (this.items.length > this.N) {
        this.items.shift();
      }
    } else {
      // Move to end of array, since it was recently used
      const [item] = this.items.splice(index, 1);
      this.items.push(item);
    }
  }

  get(key: string): V | undefined {
    return this.items.find((item) => item[0] === key)?.[1];
  }
}
