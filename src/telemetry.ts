import { Meter, metrics, Counter, Histogram, ObservableGauge } from "@opentelemetry/api";
import { OTLPMetricExporter as OTLPMetricExporterGRPC } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import logger from "./util/logger.js";

export interface TelemetryConfig {
  serviceName?: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  otlpHeaders?: Record<string, string>;
  exportInterval?: number; // in milliseconds
  protocol?: "http" | "grpc";
  enabled?: boolean;
}

export class ContinueCLITelemetry {
  private sdk: NodeSDK | null = null;
  private meterProvider: MeterProvider | null = null;
  private meter: Meter | null = null;
  private config: Required<TelemetryConfig>;
  
  // Pre-created instruments to avoid creating new ones on each call
  private commandCounter: Counter | null = null;
  private commandDurationHistogram: Histogram | null = null;
  private chatInteractionCounter: Counter | null = null;
  private chatResponseTimeHistogram: Histogram | null = null;
  private chatMessageLengthHistogram: Histogram | null = null;

  constructor(config: TelemetryConfig = {}) {
    // Parse standard OpenTelemetry environment variables
    const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const otelProtocol =
      process.env.OTEL_EXPORTER_OTLP_PROTOCOL?.toLowerCase() as
        | "http"
        | "grpc"
        | undefined;
    const otelHeaders = this.parseOtelHeaders(
      process.env.OTEL_EXPORTER_OTLP_HEADERS
    );
    const otelMetricInterval = process.env.OTEL_METRIC_EXPORT_INTERVAL
      ? parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL)
      : undefined;
    const otelMetricsExporter =
      process.env.OTEL_METRICS_EXPORTER?.toLowerCase();

    // Determine if telemetry should be enabled
    const isEnabled =
      otelMetricsExporter === "otlp" ||
      (config.enabled !== false && process.env.TELEMETRY_ENABLED !== "false");

    this.config = {
      serviceName: config.serviceName || "continue-cli",
      serviceVersion: config.serviceVersion || "1.0.0",
      otlpEndpoint:
        config.otlpEndpoint ||
        otelEndpoint ||
        "http://localhost:4318/v1/metrics",
      otlpHeaders: { ...otelHeaders, ...config.otlpHeaders },
      exportInterval: config.exportInterval || otelMetricInterval || 5000,
      protocol: config.protocol || otelProtocol || "http",
      enabled: isEnabled,
    };
  }

  /**
   * Parse OTEL_EXPORTER_OTLP_HEADERS environment variable
   * Format: "key1=value1,key2=value2"
   */
  private parseOtelHeaders(headersStr?: string): Record<string, string> {
    if (!headersStr) return {};

    const headers: Record<string, string> = {};
    headersStr.split(",").forEach((pair) => {
      const [key, value] = pair.split("=");
      if (key && value) {
        headers[key.trim()] = value.trim();
      }
    });
    return headers;
  }

  /**
   * Initialize OpenTelemetry with OTLP metrics export
   */
  public async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.debug("Telemetry disabled");
      return;
    }

    try {
      // Dynamic import to work around ESM issues
      const { resourceFromAttributes } = await import(
        "@opentelemetry/resources"
      );

      // Create resource with service information
      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.config.serviceName,
        [ATTR_SERVICE_VERSION]: this.config.serviceVersion,
      });

      // Create OTLP metric exporter based on protocol
      let metricExporter;
      let endpointUrl = this.config.otlpEndpoint;

      if (this.config.protocol === "grpc") {
        // For gRPC, ensure we don't have /v1/metrics path
        if (endpointUrl.endsWith("/v1/metrics")) {
          endpointUrl = endpointUrl.replace("/v1/metrics", "");
        }
        metricExporter = new OTLPMetricExporterGRPC({
          url: endpointUrl,
          headers: this.config.otlpHeaders,
        });
      } else {
        // For HTTP, ensure we have the /v1/metrics path
        if (!endpointUrl.endsWith("/v1/metrics")) {
          endpointUrl = endpointUrl.replace(/\/$/, "") + "/v1/metrics";
        }
        metricExporter = new OTLPMetricExporter({
          url: endpointUrl,
          headers: this.config.otlpHeaders,
        });
      }

      // Create metric reader
      const metricReader = new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: this.config.exportInterval,
      });

      // Create meter provider
      this.meterProvider = new MeterProvider({
        resource,
        readers: [metricReader],
      });

      // Set global meter provider
      metrics.setGlobalMeterProvider(this.meterProvider);

      // Get a meter instance
      this.meter = metrics.getMeter(
        this.config.serviceName,
        this.config.serviceVersion
      );

      // Initialize all instruments once during setup
      this.initializeInstruments();

      logger.debug(
        `Telemetry initialized - Protocol: ${this.config.protocol}, Endpoint: ${endpointUrl}`
      );
      if (Object.keys(this.config.otlpHeaders).length > 0) {
        logger.debug(
          `Headers configured: ${Object.keys(this.config.otlpHeaders).join(
            ", "
          )}`
        );
      }
    } catch (error) {
      logger.error("Failed to initialize telemetry:", error);
    }
  }

  /**
   * Initialize all instruments once during setup to avoid creating new ones on each call
   */
  private initializeInstruments(): void {
    if (!this.meter) return;

    // Command metrics
    this.commandCounter = this.meter.createCounter(
      "cli_commands_total",
      {
        description: "Total number of CLI commands executed",
        unit: "1",
      }
    );

    this.commandDurationHistogram = this.meter.createHistogram(
      "cli_command_duration",
      {
        description: "Duration of CLI command execution",
        unit: "ms",
      }
    );

    // Chat interaction metrics
    this.chatInteractionCounter = this.meter.createCounter(
      "cli_chat_interactions_total",
      {
        description: "Total number of chat interactions",
        unit: "1",
      }
    );

    this.chatResponseTimeHistogram = this.meter.createHistogram(
      "cli_chat_response_time",
      {
        description: "Time to receive chat response",
        unit: "ms",
      }
    );

    this.chatMessageLengthHistogram = this.meter.createHistogram(
      "cli_chat_message_length",
      {
        description: "Length of chat messages",
        unit: "characters",
      }
    );
  }

  /**
   * Create a counter metric
   */
  public createCounter(name: string, description?: string, unit?: string) {
    if (!this.meter) {
      logger.warn("Telemetry not initialized, counter not created");
      return null;
    }

    return this.meter.createCounter(name, {
      description: description || `Counter for ${name}`,
      unit: unit || "1",
    });
  }

  /**
   * Create a histogram metric
   */
  public createHistogram(name: string, description?: string, unit?: string) {
    if (!this.meter) {
      logger.warn("Telemetry not initialized, histogram not created");
      return null;
    }

    return this.meter.createHistogram(name, {
      description: description || `Histogram for ${name}`,
      unit: unit || "ms",
    });
  }

  /**
   * Create a gauge metric
   */
  public createGauge(name: string, description?: string, unit?: string) {
    if (!this.meter) {
      logger.warn("Telemetry not initialized, gauge not created");
      return null;
    }

    return this.meter.createObservableGauge(name, {
      description: description || `Gauge for ${name}`,
      unit: unit || "1",
    });
  }

  /**
   * Send a test counter metric
   */
  public sendTestMetric(): void {
    if (!this.config.enabled || !this.meter) {
      logger.debug("Telemetry not enabled or not initialized");
      return;
    }

    const testCounter = this.createCounter(
      "cli_test_counter",
      "A test counter to verify OTLP metrics are working",
      "1"
    );

    if (testCounter) {
      testCounter.add(1, {
        test_attribute: "test_value",
        timestamp: new Date().toISOString(),
        environment: "test",
      });
      logger.debug("Test metric sent: cli_test_counter incremented by 1");
    }
  }

  /**
   * Record CLI command execution
   */
  public recordCommand(
    command: string,
    duration: number,
    success: boolean
  ): void {
    if (!this.config.enabled || !this.meter) return;

    const attributes = {
      command,
      success: success.toString(),
    };

    // Use pre-created instruments instead of creating new ones
    this.commandCounter?.add(1, attributes);
    this.commandDurationHistogram?.record(duration, attributes);
  }

  /**
   * Record chat interaction metrics
   */
  public recordChatInteraction(
    messageLength: number,
    responseTime: number
  ): void {
    if (!this.config.enabled || !this.meter) return;

    // Use pre-created instruments instead of creating new ones
    this.chatInteractionCounter?.add(1);
    this.chatResponseTimeHistogram?.record(responseTime);
    this.chatMessageLengthHistogram?.record(messageLength);
  }

  /**
   * Get current configuration (for debugging)
   */
  public getConfig() {
    return { ...this.config };
  }

  /**
   * Cleanup and shutdown telemetry
   */
  public async shutdown(): Promise<void> {
    if (this.meterProvider) {
      try {
        await this.meterProvider.shutdown();
        logger.debug("Telemetry shutdown completed");
      } catch (error) {
        logger.error("Error during telemetry shutdown:", error);
      }
    }
  }
}

// Export singleton instance
export const telemetry = new ContinueCLITelemetry();

// Export initialization function for easy setup
export async function initializeTelemetry(
  config?: TelemetryConfig
): Promise<void> {
  const instance = new ContinueCLITelemetry(config);
  await instance.initialize();

  // Send test metric on initialization
  setTimeout(() => {
    instance.sendTestMetric();
  }, 1000);
}