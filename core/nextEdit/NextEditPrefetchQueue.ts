import { RangeInFile } from "..";
import { NextEditProvider } from "./NextEditProvider";
import { NextEditOutcome } from "./types";

interface ProcessedItem {
  location: RangeInFile;
  outcome: NextEditOutcome; // Result from the model
}

export class PrefetchQueue {
  private static instance: PrefetchQueue | null = null;

  private unprocessedQueue: RangeInFile[] = [];
  private processedQueue: ProcessedItem[] = [];
  private prefetchLimit: number;
  private abortController: AbortController;

  private usingFullFileDiff: boolean = true;

  private constructor(prefetchLimit: number = 3) {
    this.prefetchLimit = prefetchLimit;
    this.abortController = new AbortController();
  }

  public static getInstance(prefetchLimit: number = 3): PrefetchQueue {
    if (!PrefetchQueue.instance) {
      PrefetchQueue.instance = new PrefetchQueue(prefetchLimit);
    }

    return PrefetchQueue.instance;
  }

  initialize(usingFullFileDiff: boolean) {
    this.usingFullFileDiff = usingFullFileDiff;
  }

  // Queue management methods
  enqueueUnprocessed(location: RangeInFile): void {
    this.unprocessedQueue.push(location);
  }

  private dequeueUnprocessed(): RangeInFile | undefined {
    return this.unprocessedQueue.shift();
  }

  enqueueProcessed(item: ProcessedItem): void {
    this.processedQueue.push(item);
  }

  dequeueProcessed(): ProcessedItem | undefined {
    return this.processedQueue.shift();
  }

  // Process items from unprocessed queue
  async process(ctx: any): Promise<void> {
    while (
      this.unprocessedQueue.length > 0 &&
      this.processedQueue.length < this.prefetchLimit &&
      !this.abortController.signal.aborted
    ) {
      const location = this.dequeueUnprocessed();
      if (!location) break;

      try {
        const outcome =
          await NextEditProvider.getInstance().provideInlineCompletionItemsWithChain(
            ctx,
            location,
            this.abortController.signal,
            this.usingFullFileDiff,
          );

        if (!outcome) continue;

        this.enqueueProcessed({
          location,
          outcome,
        });
      } catch (error) {
        if (!this.abortController.signal.aborted) {
          // Handle error
          console.error("Error processing item:", error);
        }
        // If aborted, we just stop processing
        break;
      }
    }
  }

  // Abort all operations
  abort(): void {
    this.abortController.abort();
    this.clear();

    // Create a new AbortController for future operations
    this.abortController = new AbortController();
  }

  // Clear all queues
  clear(): void {
    this.unprocessedQueue = [];
    this.processedQueue = [];
  }

  // Additional helper methods
  get unprocessedCount(): number {
    return this.unprocessedQueue.length;
  }

  get processedCount(): number {
    return this.processedQueue.length;
  }

  peekProcessed(): ProcessedItem | undefined {
    return this.processedQueue[0];
  }

  setPreetchLimit(limit: number): void {
    this.prefetchLimit = limit;
  }
}
