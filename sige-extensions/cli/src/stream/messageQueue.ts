import { EventEmitter } from "events";

import type { InputHistory } from "../util/inputHistory.js";
import { logger } from "../util/logger.js";

export interface QueuedMessage {
  message: string;
  imageMap?: Map<string, Buffer>;
  timestamp: number;
  history?: InputHistory;
}

export interface MessageProcessor {
  (message: string, imageMap?: Map<string, Buffer>): Promise<void>;
}

/**
 * A queue to store messages that need to be processed later
 */
class MessageQueue extends EventEmitter {
  private queue: QueuedMessage[] = [];

  constructor() {
    super();
  }

  async enqueueMessage(
    message: string,
    imageMap?: Map<string, Buffer>,
    history?: InputHistory,
  ): Promise<boolean> {
    const queuedMessage: QueuedMessage = {
      message,
      imageMap,
      timestamp: Date.now(),
      history,
    };

    this.queue.push(queuedMessage);
    logger.debug("MessageQueue: Message queued", {
      queueLength: this.queue.length,
    });

    // Emit event for UI to show the queued message
    this.emit("messageQueued", queuedMessage);

    return true;
  }

  /**
   * Dequeues and returns the next message to be processed (FIFO - oldest first)
   */
  public getNextMessage(): QueuedMessage | undefined {
    return this.queue.shift();
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export const messageQueue = new MessageQueue();
