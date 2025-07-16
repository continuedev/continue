import { NextEditProvider } from "../nextEdit/NextEditProvider";

export class PrefetchQueue<T, R, O> {
  private currentPromise: Promise<T | undefined> | null = null;
  private nextPromise: Promise<T | undefined> | null = null;
  private resourceQueue: R[];
  private other: O | undefined;
  private fetchFunction: (
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
    // if (this.resourceQueue.length > 0) {
    //   throw new Error("Queue already initialized");
    // }
    this.resourceQueue = [...this.resourceQueue, ...resources];
  }

  loadOther(other: O) {
    this.other = other;
  }

  async initialize(): Promise<void> {
    // Get the first response (no resource needed).
    this.currentPromise = this.fetchFunction(undefined, undefined, this.other);
    const firstData = await this.currentPromise;
    // TODO: cleanse editable_region_start and trailing newline.

    // Create the next promise based on the first response and first resource.
    // if (this.resourceQueue.length > 0) {
    const resource = this.resourceQueue.shift()!;
    this.nextPromise = this.fetchFunction(firstData, resource, this.other);
    // }
  }

  async pop(): Promise<T | undefined> {
    if (!this.currentPromise) {
      // throw new Error("Queue not initialized");
      return undefined;
    }

    const currentData = await this.currentPromise;

    // Move next promise to current (if it exists).
    if (this.nextPromise) {
      this.currentPromise = this.nextPromise;

      // Create new next promise if we have resources left.
      const resource = this.resourceQueue.shift()!;
      this.nextPromise = this.currentPromise.then((data) =>
        this.fetchFunction(data, resource, this.other),
      );
      // if (this.resourceQueue.length > 0) {
      // } else {
      //   this.nextPromise = null;
      // }
    } else {
      NextEditProvider.currentEditChainId = null;
      // throw new Error("No more items in queue");
      return undefined;
    }

    console.log("currentData:", currentData);
    return currentData;
  }

  hasNext(): boolean {
    return this.nextPromise !== null;
  }

  getRemainingResourceCount(): number {
    return this.resourceQueue.length;
  }
}
