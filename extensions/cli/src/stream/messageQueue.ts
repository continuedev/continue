import { InputHistory } from "../util/inputHistory.js";
import { logger } from "../util/logger.js";

export interface QueuedMessage {
  message: string;
  imageMap?: Map<string, Buffer>;
  timestamp: number;
}

export interface MessageProcessor {
  (message: string, imageMap?: Map<string, Buffer>): Promise<void>;
}

/**
 * A queue to store messages that need to be processed later
 */
class MessageQueue {
  private queue: QueuedMessage[] = [];
  private inputHistory: InputHistory | undefined;

  async enqueueMessage(
    message: string,
    imageMap?: Map<string, Buffer>,
    inputHistory?: InputHistory,
  ): Promise<boolean> {
    this.inputHistory = inputHistory;

    const queuedMessage: QueuedMessage = {
      message,
      imageMap,
      timestamp: Date.now(),
    };

    this.queue.push(queuedMessage);
    logger.debug("MessageQueue: Message queued", {
      queueLength: this.queue.length,
    });

    return true;
  }

  public getLatestMessage() {
    if (this.queue.length === 0) return undefined;
    const latestMessage = this.queue.shift();
    logger.debug("MessageQueue: Message dequeued", {
      queueLength: this.queue.length,
    });
    this.inputHistory?.addEntry(latestMessage!.message);
    return latestMessage;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export const messageQueue = new MessageQueue();
