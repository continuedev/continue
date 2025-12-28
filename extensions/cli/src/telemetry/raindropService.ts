import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  BatchSpanProcessor,
  NodeTracerProvider,
} from "@opentelemetry/sdk-trace-node";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

import { logger } from "../util/logger.js";

interface RaindropConfig {
  apiKey: string;
  enabled: boolean;
}

interface RaindropMetadata {
  userId?: string;
  convoId?: string;
  eventName?: string;
}

/**
 * RaindropService manages OpenTelemetry trace collection for Vercel AI SDK calls.
 * This service is opt-in and only activates when RAINDROP_API_KEY is present.
 *
 * Traces are sent to Raindrop.ai for observability of LLM performance, costs, and errors.
 */
class RaindropService {
  private sdk: NodeSDK | null = null;
  private provider: NodeTracerProvider | null = null;
  private config: RaindropConfig;
  private initialized = false;
  private metadata: RaindropMetadata = {};

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): RaindropConfig {
    const apiKey =
      process.env.RAINDROP_WRITE_KEY || process.env.RAINDROP_API_KEY;
    return {
      apiKey: apiKey ?? "",
      enabled: !!apiKey && apiKey.trim().length > 0,
    };
  }

  /**
   * Initialize OpenTelemetry SDK with Raindrop trace exporter.
   * Sets RAINDROP_ENABLED environment variable for openai-adapters to read.
   * Gracefully degrades on errors - will not block CLI startup.
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.debug(
        "Raindrop observability disabled (no RAINDROP_WRITE_KEY or RAINDROP_API_KEY)",
      );
      return;
    }

    try {
      // Set environment variable for Vercel SDK to read
      process.env.RAINDROP_ENABLED = "true";

      const resource = resourceFromAttributes({
        [SEMRESATTRS_SERVICE_NAME]: "continue-cli",
      });

      const traceExporter = new OTLPTraceExporter({
        url: "https://api.raindrop.ai/v1/traces",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      const spanProcessor = new BatchSpanProcessor(traceExporter);

      // Create and register a global tracer provider
      // This is what Vercel SDK's experimental_telemetry will use
      this.provider = new NodeTracerProvider({
        resource,
        spanProcessors: [spanProcessor],
      });
      this.provider.register();

      // Also use NodeSDK for complete setup
      this.sdk = new NodeSDK({
        resource,
        spanProcessors: [spanProcessor],
      });

      // Add timeout protection to prevent hanging
      const initTimeout = setTimeout(() => {
        logger.warn(
          "Raindrop initialization timeout - continuing without traces",
        );
        this.config.enabled = false;
      }, 5000); // 5 second timeout

      await this.sdk.start();
      clearTimeout(initTimeout);

      this.initialized = true;
      logger.debug("Raindrop observability initialized");
    } catch (error) {
      logger.error("Failed to initialize Raindrop:", error);
      this.config.enabled = false;
      // Don't throw - gracefully degrade
    }
  }

  /**
   * Check if Raindrop is enabled and initialized.
   */
  isEnabled(): boolean {
    return this.config.enabled && this.initialized;
  }

  /**
   * Set metadata for the current session.
   * Metadata is passed to Vercel SDK via environment variables.
   *
   * @param metadata - Session metadata (userId, convoId, eventName)
   */
  setMetadata(metadata: Partial<RaindropMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata };

    // Update environment variables for Vercel SDK to read
    if (metadata.userId) {
      process.env.RAINDROP_USER_ID = metadata.userId;
    }
    if (metadata.convoId) {
      process.env.RAINDROP_CONVO_ID = metadata.convoId;
    }
    if (metadata.eventName) {
      process.env.RAINDROP_EVENT_NAME = metadata.eventName;
    }
  }

  /**
   * Get current metadata.
   */
  getMetadata(): RaindropMetadata {
    return { ...this.metadata };
  }

  /**
   * Shutdown the OpenTelemetry SDK.
   * Ensures traces are flushed before exit.
   */
  async shutdown(): Promise<void> {
    if (this.sdk && this.initialized) {
      try {
        // Give the SDK extra time to flush traces before shutting down
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await this.sdk.shutdown();
        logger.debug("Raindrop SDK shutdown complete");
      } catch (error) {
        logger.error("Error shutting down Raindrop SDK:", error);
      }
    }
  }
}

// Export singleton instance
export const raindropService = new RaindropService();

/**
 * Setup Raindrop metadata for the current session.
 * Helper to avoid code duplication across commands.
 *
 * @param userId - User ID from auth service
 * @param convoId - Session/conversation ID
 * @param eventName - Command name (e.g., "cn-chat", "cn-serve", "cn-headless")
 */
export function setupRaindropMetadataFromParams(
  userId: string,
  convoId: string,
  eventName: string,
): void {
  if (!raindropService.isEnabled()) {
    return;
  }

  raindropService.setMetadata({
    userId,
    convoId,
    eventName,
  });
}
