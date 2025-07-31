import { NextEditProvider } from "./NextEditProvider";

export class PrefetchQueue {
  private unprocessedQueue: EditLocation[] = [];
  private processedQueue: ProcessedItem[] = [];
  private prefetchLimit: number;
  private abortController: AbortController;

  constructor(prefetchLimit: number = 3) {
    this.prefetchLimit = prefetchLimit;
    this.abortController = new AbortController();
  }

  // Queue management methods
  enqueueUnprocessed(location: EditLocation): void {
    this.unprocessedQueue.push(location);
  }

  dequeueUnprocessed(): EditLocation | undefined {
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
    let processCount = 0;

    while (
      this.unprocessedQueue.length > 0 &&
      processCount < this.prefetchLimit &&
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
          );

        this.enqueueProcessed({
          location,
          outcome,
        });

        processCount++;
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
}

// Types
interface EditLocation {
  // Define properties for edit location
  // e.g., file, position, etc.
}

interface ProcessedItem {
  location: EditLocation;
  outcome: any; // Result from the model
}
