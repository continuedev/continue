import { Position } from "..";
import { NextEditOutcome } from "./types";

export interface PrefetchQueueItem {
  editableRegionStartLine: number;
  editableRegionEndLine: number;
  cursorPosition: Position;
  outcome?: NextEditOutcome;
  completionId?: string;
  inProgress: boolean;
}

export class NextEditPrefetchQueue {
  private static _instance: NextEditPrefetchQueue;
  private queue: PrefetchQueueItem[] = [];
  private maxQueueSize: number = 3; // Limit queue size to prevent too many requests. We don't need to be too eager.

  private constructor() {}

  public static getInstance(): NextEditPrefetchQueue {
    if (!NextEditPrefetchQueue._instance) {
      NextEditPrefetchQueue._instance = new NextEditPrefetchQueue();
    }
    return NextEditPrefetchQueue._instance;
  }

  public enqueue(item: PrefetchQueueItem): void {
    // Deduplication logic.
    if (
      this.queue.some(
        (queueItem) =>
          queueItem.editableRegionStartLine === item.editableRegionStartLine,
      )
    ) {
      return;
    }

    // Shift off oldest item in the queue.
    while (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }

    this.queue.push(item);
  }

  public dequeue(): PrefetchQueueItem | undefined {
    return this.queue.shift();
  }

  public getNextUnprocessedItem(): PrefetchQueueItem | undefined {
    return this.queue.find((item) => !item.inProgress && !item.outcome);
  }

  public updateItemWithOutcome(
    startLine: number,
    outcome: NextEditOutcome,
    completionId: string,
  ): void {
    const item = this.queue.find(
      (item) => item.editableRegionStartLine === startLine,
    );
    if (item) {
      item.outcome = outcome;
      item.completionId = completionId;
      item.inProgress = false;
    }
  }

  public markItemInProgress(startLine: number): void {
    const item = this.queue.find(
      (item) => item.editableRegionStartLine === startLine,
    );
    if (item) {
      item.inProgress = true;
    }
  }

  public getItemByStartLine(startLine: number): PrefetchQueueItem | undefined {
    return this.queue.find(
      (item) => item.editableRegionStartLine === startLine,
    );
  }

  public clear(): void {
    this.queue = [];
  }

  public size(): number {
    return this.queue.length;
  }
}
