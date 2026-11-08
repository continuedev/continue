import { EventEmitter } from "events";

import type { InputHistory } from "../util/inputHistory.js";
import { logger } from "../util/logger.js";

/**
 * Messages typed while the agent works.
 *
 * The queue is the single source of truth: the TUI renders `list()` and never
 * keeps its own copy, so what is shown is exactly what will be sent.
 *
 * Lifecycle:
 * - Enter while the agent works queues the message.
 * - When the turn ends, every queued plain message goes out as ONE user
 *   message (joined by blank lines). Slash commands and `!` shell commands are
 *   held and run one at a time, in order, because merging them with text would
 *   stop them being commands.
 * - Steering (`requestSteer()`): the queued plain messages are delivered at
 *   the next tool boundary, inside the running turn, instead of at its end.
 * - Stop (Esc) and errors pause the queue: the messages stay, nothing is sent
 *   until the person resumes (Enter on an empty prompt) or sends a new
 *   message, which carries the queue with it.
 * - Reordering: Down on an empty prompt selects a queued message; + and -
 *   move it, which changes the order it is merged and sent in. The selection
 *   lives here so the highlighted line is always one still queued.
 */
export interface QueuedMessage {
  id: string;
  message: string;
  imageMap?: Map<string, Buffer>;
  timestamp: number;
  history?: InputHistory;
}

export interface MessageProcessor {
  (message: string, imageMap?: Map<string, Buffer>): Promise<void>;
}

export interface MergedQueuedMessage {
  message: string;
  imageMap?: Map<string, Buffer>;
}

/** Slash commands and `!` shell commands are not merged with other text. */
export function isQueuedCommand(message: string): boolean {
  return /^[/!]/.test(message.trimStart());
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace every placeholder in `text` in one pass, so renaming `#1` to `#2`
 * and `#2` to `#3` cannot rename the same occurrence twice.
 */
export function renamePlaceholders(
  text: string,
  renames: Map<string, string>,
): string {
  const keys = Array.from(renames.keys()).filter((k) => k.length > 0);
  if (keys.length === 0) return text;
  keys.sort((a, b) => b.length - a.length);
  const pattern = new RegExp(keys.map(escapeRegExp).join("|"), "g");
  return text.replace(pattern, (match) => renames.get(match) ?? match);
}

/**
 * Join queued messages into one, separated by blank lines. Every input box
 * numbers its images from `[Image #1]`, so placeholders are renumbered to
 * keep each image attached to the text that referred to it.
 */
export function mergeQueuedMessages(
  items: readonly Pick<QueuedMessage, "message" | "imageMap">[],
): MergedQueuedMessage | undefined {
  if (items.length === 0) return undefined;

  const imageMap = new Map<string, Buffer>();
  let counter = 0;
  const parts = items.map((item) => {
    if (!item.imageMap || item.imageMap.size === 0) return item.message;
    const renames = new Map<string, string>();
    for (const [placeholder, buffer] of item.imageMap) {
      counter++;
      const renamed = `[Image #${counter}]`;
      renames.set(placeholder, renamed);
      imageMap.set(renamed, buffer);
    }
    return renamePlaceholders(item.message, renames);
  });

  return {
    message: parts.join("\n\n"),
    imageMap: imageMap.size > 0 ? imageMap : undefined,
  };
}

export class MessageQueue extends EventEmitter {
  private queue: QueuedMessage[] = [];
  private nextId = 1;
  private steerRequested = false;
  private paused = false;
  private selectedId: string | null = null;

  constructor() {
    super();
  }

  private changed(): void {
    // A selected message that left the queue is no longer selected
    if (this.selectedId && !this.queue.some((m) => m.id === this.selectedId)) {
      this.selectedId = null;
    }
    this.emit("changed", this.list());
  }

  async enqueueMessage(
    message: string,
    imageMap?: Map<string, Buffer>,
    history?: InputHistory,
  ): Promise<boolean> {
    const queuedMessage: QueuedMessage = {
      id: `q${this.nextId++}`,
      message,
      imageMap,
      timestamp: Date.now(),
      history,
    };

    this.queue.push(queuedMessage);
    logger.debug("MessageQueue: Message queued", {
      queueLength: this.queue.length,
    });

    this.emit("messageQueued", queuedMessage);
    this.changed();

    return true;
  }

  /**
   * Put a message back at the front of the queue: what Up took back into
   * the prompt, when Ctrl+C would otherwise throw it away.
   */
  putBack(message: string, imageMap?: Map<string, Buffer>): QueuedMessage {
    const item: QueuedMessage = {
      id: `q${this.nextId++}`,
      message,
      imageMap,
      timestamp: Date.now(),
    };
    this.queue.unshift(item);
    this.changed();
    return item;
  }

  /** A snapshot of the queue, oldest first. */
  list(): QueuedMessage[] {
    return [...this.queue];
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex((m) => m.id === id);
    if (index < 0) return false;
    this.queue.splice(index, 1);
    if (this.queue.length === 0) this.steerRequested = false;
    this.changed();
    return true;
  }

  /**
   * Move a message to position `to` (0-based, clamped to the queue): the
   * order the queue is merged and sent in. Returns false when nothing moved.
   */
  move(id: string, to: number): boolean {
    const from = this.queue.findIndex((m) => m.id === id);
    if (from < 0) return false;
    const target = Math.max(0, Math.min(this.queue.length - 1, to));
    if (target === from) return false;
    const [item] = this.queue.splice(from, 1);
    this.queue.splice(target, 0, item);
    this.changed();
    return true;
  }

  /** Highlight a queued message in the TUI, or clear it with null. */
  select(id: string | null): void {
    const next = id && this.queue.some((m) => m.id === id) ? id : null;
    if (next === this.selectedId) return;
    this.selectedId = next;
    this.changed();
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  update(id: string, message: string): boolean {
    const item = this.queue.find((m) => m.id === id);
    if (!item) return false;
    item.message = message;
    this.changed();
    return true;
  }

  /** Drop everything queued, and any pending steer request. */
  clear(): void {
    const hadState = this.queue.length > 0 || this.steerRequested;
    this.queue = [];
    this.steerRequested = false;
    if (hadState) this.changed();
  }

  /**
   * Dequeues and returns the next message to be processed (FIFO - oldest first)
   */
  getNextMessage(): QueuedMessage | undefined {
    const next = this.queue.shift();
    if (next) {
      if (this.queue.length === 0) this.steerRequested = false;
      this.changed();
    }
    return next;
  }

  /** Remove and return every queued message. */
  takeAll(): QueuedMessage[] {
    const taken = this.queue;
    this.queue = [];
    this.steerRequested = false;
    if (taken.length > 0) this.changed();
    return taken;
  }

  /**
   * Remove and return what the end of a turn sends next: one command on its
   * own, or the run of plain messages up to the next command. Returns an
   * empty array while paused.
   */
  takeNextBatch(): QueuedMessage[] {
    if (this.paused || this.queue.length === 0) return [];
    let count = 1;
    if (!isQueuedCommand(this.queue[0].message)) {
      while (
        count < this.queue.length &&
        !isQueuedCommand(this.queue[count].message)
      ) {
        count++;
      }
    }
    const batch = this.queue.splice(0, count);
    if (this.queue.length === 0) this.steerRequested = false;
    this.changed();
    return batch;
  }

  /**
   * Ask for the queued plain messages to be delivered at the next tool
   * boundary. Returns false when there is nothing to steer with.
   */
  requestSteer(): boolean {
    if (!this.queue.some((m) => !isQueuedCommand(m.message))) return false;
    this.steerRequested = true;
    this.paused = false;
    this.changed();
    return true;
  }

  isSteerRequested(): boolean {
    return this.steerRequested;
  }

  /**
   * At a tool boundary: when steering was requested, remove and return the
   * queued plain messages (commands stay queued for the end of the turn).
   */
  takeSteerMessages(): QueuedMessage[] {
    if (!this.steerRequested) return [];
    this.steerRequested = false;
    const taken = this.queue.filter((m) => !isQueuedCommand(m.message));
    this.queue = this.queue.filter((m) => isQueuedCommand(m.message));
    this.changed();
    return taken;
  }

  /** Keep the queue but stop it from being sent (Stop, or an error). */
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.steerRequested = false;
    this.changed();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.changed();
  }

  isPaused(): boolean {
    return this.paused;
  }
}

export const messageQueue = new MessageQueue();
