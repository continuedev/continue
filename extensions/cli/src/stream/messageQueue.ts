import { EventEmitter } from "events";

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
class MessageQueue extends EventEmitter {
  private queue: QueuedMessage[] = [];
  private inputHistory: InputHistory | undefined;

  constructor() {
    super();
  }

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

    // Emit event for UI to show the queued message
    this.emit("messageQueued", queuedMessage);

    return true;
  }

  public getAllQueuedMessages() {
    if (this.queue.length === 0) return undefined;

    // Combine all queued messages into one
    const combinedMessage = this.queue.map((msg) => msg.message).join("\n");
    const combinedImageMap = new Map<string, Buffer>();

    // Merge all image maps
    for (const queuedMsg of this.queue) {
      if (queuedMsg.imageMap) {
        for (const [key, value] of queuedMsg.imageMap) {
          combinedImageMap.set(key, value);
        }
      }
    }

    const result = {
      message: combinedMessage,
      imageMap: combinedImageMap.size > 0 ? combinedImageMap : undefined,
      timestamp: Date.now(),
    };

    // Add to input history and clear the queue
    this.inputHistory?.addEntry(combinedMessage);
    this.queue = [];

    logger.debug("MessageQueue: All messages dequeued and combined", {
      combinedLength: combinedMessage.length,
      queueLength: this.queue.length,
    });

    return result;
  }

  public getLatestMessage() {
    return this.getAllQueuedMessages();
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export const messageQueue = new MessageQueue();
