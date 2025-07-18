import { NextEditProvider } from "../nextEdit/NextEditProvider";

export class PrefetchQueue<T, R, O> {
  protected promiseQueue: Promise<T | undefined>[] = [];
  protected resourceQueue: R[];
  protected other: O | undefined;
  protected fetchFunction: (
    previousData: T | undefined,
    resource: R | undefined,
    other: O | undefined,
  ) => Promise<T | undefined>;

  constructor(
    fetchFunction: (
      previousData: T | undefined,
      resource: R | undefined,
      other: O | undefined,
    ) => Promise<T | undefined>,
    resources: R[],
    other: O | undefined,
  ) {
    this.fetchFunction = fetchFunction;
    this.resourceQueue = [...resources];
    this.other = other;
  }

  loadResource(resources: R[]) {
    this.resourceQueue = [...this.resourceQueue, ...resources];
  }

  loadOther(other: O) {
    this.other = other;
  }

  async initialize(): Promise<void> {
    // Get the first response (no resource needed)
    const firstPromise = this.fetchFunction(undefined, undefined, this.other);
    this.promiseQueue.push(firstPromise);

    // Prefetch the next item using the first resource
    const firstData = await firstPromise;
    if (this.resourceQueue.length > 0) {
      const resource = this.resourceQueue.shift()!;
      const nextPromise = this.fetchFunction(firstData, resource, this.other);
      this.promiseQueue.push(nextPromise);
    }
  }

  async pop(): Promise<T | undefined> {
    if (this.promiseQueue.length === 0) {
      return undefined;
    }

    // Get and remove the first promise from the queue
    const currentPromise = this.promiseQueue.shift()!;
    const currentData = await currentPromise;

    // If we have resources left, prefetch the next item
    if (this.resourceQueue.length > 0) {
      // Get the most recently added promise (now at the end of the queue)
      const previousPromise =
        this.promiseQueue.length > 0
          ? this.promiseQueue[this.promiseQueue.length - 1]
          : Promise.resolve(currentData);

      // Create new promise based on the previous one and next resource
      const resource = this.resourceQueue.shift()!;
      const nextPromise = previousPromise.then((data) =>
        this.fetchFunction(data, resource, this.other),
      );

      this.promiseQueue.push(nextPromise);
    } else if (this.promiseQueue.length === 0) {
      // No more items in the queue and no more resources
    }

    console.log("currentData:", currentData);
    return currentData;
  }

  hasNext(): boolean {
    return this.promiseQueue.length > 0;
  }

  getRemainingResourceCount(): number {
    return this.resourceQueue.length;
  }
}

