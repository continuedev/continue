import { EventEmitter } from "events";
import { logger } from "../util/logger.js";

/**
 * OceanBusService - Direct SSE connection to ocean-bus event stream
 *
 * Implements the same pattern as Ship: maintains continuous SSE connection,
 * queues events, provides access to event queue for autonomous agents.
 *
 * NOT an MCP server - direct connection in application code.
 */

export interface OceanBusEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface OceanBusServiceState {
  connected: boolean;
  url: string;
  eventQueue: OceanBusEvent[];
  reconnectAttempts: number;
}

export class OceanBusService extends EventEmitter {
  private state: OceanBusServiceState;
  private abortController: AbortController | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly maxQueueSize = 100;
  private readonly maxBackoff = 60000; // 60 seconds
  private readonly initialBackoff = 5000; // 5 seconds

  constructor(oceanBusUrl: string = "http://localhost:8765") {
    super();
    this.state = {
      connected: false,
      url: oceanBusUrl,
      eventQueue: [],
      reconnectAttempts: 0,
    };
  }

  /**
   * Start the ocean-bus subscription
   */
  async start(): Promise<void> {
    if (this.abortController) {
      logger.warn("OceanBusService already started");
      return;
    }

    logger.info("Starting ocean-bus subscription...");
    this.abortController = new AbortController();
    this.subscribe();
  }

  /**
   * Stop the ocean-bus subscription
   */
  async stop(): Promise<void> {
    logger.info("Stopping ocean-bus subscription...");

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.state.connected = false;
    this.emit("disconnected");
  }

  /**
   * Get queued events (optionally filtered by type)
   */
  getEvents(eventTypes?: string[], clear: boolean = true): OceanBusEvent[] {
    let events = this.state.eventQueue;

    // Filter by event type if specified
    if (eventTypes && eventTypes.length > 0) {
      events = events.filter((event) => eventTypes.includes(event.type));
    }

    // Clear queue if requested
    if (clear) {
      this.state.eventQueue = [];
    }

    return events;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.state.eventQueue.length;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.connected;
  }

  /**
   * Main subscription loop - maintains SSE connection with auto-reconnect
   */
  private async subscribe(): Promise<void> {
    const url = `${this.state.url}/subscribe`;

    try {
      const response = await fetch(url, {
        signal: this.abortController?.signal,
        headers: {
          Accept: "text/event-stream",
        },
      });

      if (!response.ok) {
        throw new Error(`Ocean-bus connection failed: ${response.status}`);
      }

      // Connection successful - reset reconnect attempts
      this.state.connected = true;
      this.state.reconnectAttempts = 0;
      this.emit("connected");
      logger.info(`✓ ocean-bus connected to ${url}`);

      // Process SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          logger.info("Ocean-bus stream ended");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || line.startsWith(":")) {
            continue; // Skip empty lines and comments
          }

          if (line.startsWith("data: ")) {
            try {
              const eventData = JSON.parse(line.slice(6));

              // Skip connection events
              if (eventData.event === "connected") {
                continue;
              }

              // Queue event
              const event: OceanBusEvent = {
                type: eventData.event || "unknown",
                data: eventData,
                timestamp: eventData.created_at || new Date().toISOString(),
              };

              this.queueEvent(event);
            } catch (e) {
              logger.debug("Failed to parse SSE event:", e);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        logger.info("Ocean-bus subscription aborted");
        return;
      }

      logger.warn(`Ocean-bus connection error: ${error.message}`);
      this.state.connected = false;
      this.emit("disconnected");
    }

    // Reconnect with exponential backoff
    if (this.abortController && !this.abortController.signal.aborted) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    const backoff = Math.min(
      this.initialBackoff * Math.pow(2, this.state.reconnectAttempts),
      this.maxBackoff,
    );

    this.state.reconnectAttempts++;

    logger.info(`Reconnecting to ocean-bus in ${backoff / 1000}s...`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.subscribe();
    }, backoff);
  }

  /**
   * Queue an event and emit to listeners
   */
  private queueEvent(event: OceanBusEvent): void {
    logger.info(
      `📨 Ocean-bus event received: ${event.type} from ${event.data.from || "unknown"}`,
    );
    this.state.eventQueue.push(event);
    logger.debug(`Ocean-bus event queued: ${event.type}`, {
      queueSize: this.state.eventQueue.length,
    });
    this.emit("event", event);
    logger.debug(`Ocean-bus event emitted: ${event.type}`, {
      queueSize: this.state.eventQueue.length,
    });

    // Maintain max queue size (FIFO)
    if (this.state.eventQueue.length > this.maxQueueSize) {
      this.state.eventQueue.shift();
    }

    logger.debug(`Ocean-bus event queued: ${event.type}`, {
      queueSize: this.state.eventQueue.length,
    });
  }
}
