import os from "os";

import { metrics } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ConsoleMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_HOST_NAME,
  SEMRESATTRS_OS_TYPE,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { v4 as uuidv4 } from "uuid";

import { ContinueErrorReason } from "../../../../core/util/errors.js";
import { isHeadlessMode } from "../util/cli.js";
import { isContinueRemoteAgent, isGitHubActions } from "../util/git.js";
import { logger } from "../util/logger.js";
import { getVersion } from "../version.js";

import { detectTerminalType, parseOtelHeaders } from "./headerUtils.js";

export interface TelemetryConfig {
  enabled: boolean;
  sessionId: string;
  organizationId?: string;
  accountUuid?: string;
  includeVersion: boolean;
  includeAccountUuid: boolean;
}

class TelemetryService {
  private meterProvider: MeterProvider | null = null;
  private meter: any = null;
  private config: TelemetryConfig;
  private startTime = Date.now();
  private activeStartTime: number | null = null;
  private totalActiveTime = 0;
  private shutdownHandlersRegistered = false;

  // Metrics
  private sessionCounter: any = null;
  private linesOfCodeCounter: any = null;
  private pullRequestCounter: any = null;
  private commitCounter: any = null;
  private costCounter: any = null;
  private tokenCounter: any = null;
  private codeEditDecisionCounter: any = null;
  private activeTimeCounter: any = null;
  private authAttemptsCounter: any = null;
  private mcpConnectionsGauge: any = null;
  private startupTimeHistogram: any = null;
  private responseTimeHistogram: any = null;
  private slashCommandCounter: any = null;

  constructor() {
    this.config = this.loadConfig();
    if (this.config.enabled) {
      this.initialize();
    }
  }

  private loadConfig(): TelemetryConfig {
    const hasOtelConfig = !!(
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
      process.env.OTEL_METRICS_EXPORTER
    );

    let telemetryEnabled = true;
    if (process.env.CONTINUE_METRICS_ENABLED === "0") {
      telemetryEnabled = false;
    } else if (process.env.CONTINUE_METRICS_ENABLED === "1") {
      telemetryEnabled = true;
    } else {
      telemetryEnabled = process.env.CONTINUE_CLI_ENABLE_TELEMETRY !== "0";
    }

    const enabled = telemetryEnabled && hasOtelConfig;
    const sessionId = uuidv4();

    return {
      enabled,
      sessionId,
      organizationId: process.env.ORGANIZATION_ID,
      accountUuid: process.env.ACCOUNT_UUID,
      includeVersion: process.env.OTEL_METRICS_INCLUDE_VERSION === "true",
      includeAccountUuid:
        process.env.OTEL_METRICS_INCLUDE_ACCOUNT_UUID !== "false",
    };
  }

  private initialize() {
    try {
      // Create resource
      const resource = resourceFromAttributes({
        [SEMRESATTRS_SERVICE_NAME]: "continue-cli",
        [SEMRESATTRS_SERVICE_VERSION]: getVersion(),
        [SEMRESATTRS_HOST_NAME]: os.hostname(),
        [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]:
          process.env.NODE_ENV || "development",
        [SEMRESATTRS_OS_TYPE]: os.type(),
      });

      // Configure exporters
      const readers: any[] = [];
      const metricsExporters = (
        process.env.OTEL_METRICS_EXPORTER || "console"
      ).split(",");

      for (const exporterType of metricsExporters) {
        switch (exporterType.trim()) {
          case "otlp":
            readers.push(
              new PeriodicExportingMetricReader({
                exporter: new OTLPMetricExporter({
                  url: (() => {
                    const metricsEndpoint =
                      process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
                    if (metricsEndpoint && metricsEndpoint.trim().length > 0) {
                      return metricsEndpoint;
                    }
                    const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
                    if (base && base.trim().length > 0) {
                      const normalized = base.replace(/\/$/, "");
                      return `${normalized}/v1/metrics`;
                    }
                    return "http://localhost:4318/v1/metrics";
                  })(),
                  headers: parseOtelHeaders(
                    process.env.OTEL_EXPORTER_OTLP_HEADERS || "",
                  ),
                }),
                exportIntervalMillis: parseInt(
                  process.env.OTEL_METRIC_EXPORT_INTERVAL || "20000",
                ),
              }),
            );
            break;
          case "console":
            readers.push(
              new PeriodicExportingMetricReader({
                exporter: new ConsoleMetricExporter(),
                exportIntervalMillis: parseInt(
                  process.env.OTEL_METRIC_EXPORT_INTERVAL || "20000",
                ),
              }),
            );
            break;
        }
      }

      // Create meter provider
      this.meterProvider = new MeterProvider({
        resource,
        readers,
      });

      metrics.setGlobalMeterProvider(this.meterProvider);
      this.meter = metrics.getMeter("continue-cli", getVersion());

      this.initializeMetrics();

      // Set up graceful shutdown handlers
      this.setupShutdownHandlers();

      logger.info("Telemetry service initialized", {
        sessionId: this.config.sessionId,
        exporters: metricsExporters,
        exportInterval: process.env.OTEL_METRIC_EXPORT_INTERVAL || "20000",
      });
    } catch (error) {
      logger.error("Failed to initialize telemetry", error);
    }
  }

  /**
   * Set up process handlers to ensure metrics are flushed on shutdown
   */
  private setupShutdownHandlers() {
    if (this.shutdownHandlersRegistered) return;

    const shutdownHandler = async () => {
      logger.debug("Process shutdown detected, flushing telemetry...");
      await this.shutdown();
    };

    // Handle graceful shutdown - use once() to avoid duplicate handlers
    process.once("beforeExit", shutdownHandler);
    process.once("SIGINT", shutdownHandler);
    process.once("SIGTERM", shutdownHandler);

    this.shutdownHandlersRegistered = true;
  }

  private initializeMetrics() {
    if (!this.meter) return;

    // Core metrics (Claude Code compatible)
    this.sessionCounter = this.meter.createCounter(
      "continue_cli_session_count",
      {
        description: "Count of CLI sessions started",
        unit: "count",
      },
    );

    this.linesOfCodeCounter = this.meter.createCounter(
      "continue_cli_lines_of_code_count",
      {
        description: "Count of lines of code modified",
        unit: "count",
      },
    );

    this.pullRequestCounter = this.meter.createCounter(
      "continue_cli_pull_request_count",
      {
        description: "Number of pull requests created",
        unit: "count",
      },
    );

    this.commitCounter = this.meter.createCounter("continue_cli_commit_count", {
      description: "Number of git commits created",
      unit: "count",
    });

    this.costCounter = this.meter.createCounter("continue_cli_cost_usage", {
      description: "Cost of the Continue CLI session",
      unit: "USD",
    });

    this.tokenCounter = this.meter.createCounter("continue_cli_token_usage", {
      description: "Number of tokens used",
      unit: "tokens",
    });

    this.codeEditDecisionCounter = this.meter.createCounter(
      "continue_cli_code_edit_tool_decision",
      {
        description: "Count of code editing tool permission decisions",
        unit: "count",
      },
    );

    this.activeTimeCounter = this.meter.createCounter(
      "continue_cli_active_time_total",
      {
        description: "Total active time in seconds",
        unit: "s",
      },
    );

    // Additional Continue CLI specific metrics
    this.authAttemptsCounter = this.meter.createCounter(
      "continue_cli_auth_attempts",
      {
        description: "Authentication attempts",
        unit: "{attempt}",
      },
    );

    this.mcpConnectionsGauge = this.meter.createObservableGauge(
      "continue_cli_mcp_connections",
      {
        description: "Active MCP connections",
        unit: "{connection}",
      },
    );

    this.startupTimeHistogram = this.meter.createHistogram(
      "continue_cli_startup_time",
      {
        description: "Time from CLI start to ready state",
        unit: "ms",
      },
    );

    this.responseTimeHistogram = this.meter.createHistogram(
      "continue_cli_response_time",
      {
        description: "LLM response time metrics",
        unit: "ms",
      },
    );

    this.slashCommandCounter = this.meter.createCounter(
      "continue_cli_slash_command_usage",
      {
        description: "Count of slash commands used",
        unit: "count",
      },
    );
  }

  // Check if telemetry is enabled - this is the single point of checking
  private isEnabled(): boolean {
    return this.config.enabled && this.meter !== null;
  }

  private getStandardAttributes(
    additionalAttributes: Record<string, string> = {},
  ) {
    const attributes: Record<string, string> = { ...additionalAttributes };

    if (this.config.includeVersion) {
      attributes["app.version"] = getVersion();
    }

    if (this.config.organizationId) {
      attributes["organization.id"] = this.config.organizationId;
    }

    if (this.config.includeAccountUuid && this.config.accountUuid) {
      attributes["user.account_uuid"] = this.config.accountUuid;
    }

    // Detect terminal type
    const terminalType = detectTerminalType();
    if (terminalType) {
      attributes["terminal.type"] = terminalType;
    }

    return attributes;
  }

  // Public methods for tracking metrics

  public recordSessionStart() {
    if (!this.isEnabled()) return;

    logger.debug("Recording session start with telemetry");

    // Add extra metadata for session breakdown
    const isGitHubActionsEnv = isGitHubActions();
    const sessionAttributes = this.getStandardAttributes({
      is_headless: isHeadlessMode().toString(),
      is_github_actions: isGitHubActionsEnv.toString(),
      is_continue_remote_agent: isContinueRemoteAgent().toString(),
    });

    this.sessionCounter.add(1, sessionAttributes);
    this.recordStartupTime(Date.now() - this.startTime);
  }

  public recordLinesOfCodeModified(
    type: "added" | "removed",
    count: number,
    language?: string,
  ) {
    if (!this.isEnabled()) return;

    const attributes = this.getStandardAttributes({ type });
    if (language) {
      attributes.language = language;
    }

    this.linesOfCodeCounter.add(count, attributes);
  }

  public recordPullRequestCreated() {
    if (!this.isEnabled()) return;

    this.pullRequestCounter.add(1, this.getStandardAttributes());
  }

  public recordCommitCreated() {
    if (!this.isEnabled()) return;

    this.commitCounter.add(1, this.getStandardAttributes());
  }

  public recordCost(cost: number, model: string) {
    if (!this.isEnabled()) return;

    this.costCounter.add(cost, this.getStandardAttributes({ model }));
  }

  public recordTokenUsage(
    tokens: number,
    type: "input" | "output" | "cacheRead" | "cacheCreation",
    model: string,
  ) {
    if (!this.isEnabled()) return;

    this.tokenCounter.add(tokens, this.getStandardAttributes({ type, model }));
  }

  public recordCodeEditDecision(
    tool: string,
    decision: "accept" | "reject",
    language?: string,
  ) {
    if (!this.isEnabled()) return;

    const attributes = this.getStandardAttributes({ tool, decision });
    if (language) {
      attributes.language = language;
    }

    this.codeEditDecisionCounter.add(1, attributes);
  }

  public startActiveTime() {
    if (!this.isEnabled()) return;

    if (this.activeStartTime === null) {
      this.activeStartTime = Date.now();
    }
  }

  public stopActiveTime() {
    if (!this.isEnabled()) return;

    if (this.activeStartTime !== null) {
      const deltaMs = Date.now() - this.activeStartTime;
      this.totalActiveTime += deltaMs;
      this.activeStartTime = null;

      // Record only the delta for this active window (in seconds)
      this.activeTimeCounter.add(deltaMs / 1000, this.getStandardAttributes());
    }
  }

  public recordAuthAttempt(
    result: "success" | "failure" | "cancelled",
    method: "workos" | "token",
  ) {
    if (!this.isEnabled()) return;

    this.authAttemptsCounter.add(
      1,
      this.getStandardAttributes({ result, method }),
    );
  }

  public recordMCPConnection(
    serverName: string,
    status: "connected" | "disconnected" | "error",
  ) {
    if (!this.isEnabled()) return;

    const value = status === "connected" ? 1 : 0;
    // Note: Observable gauge callback will be implemented when MCP monitoring is added
    if (this.mcpConnectionsGauge) {
      // This is a placeholder - observable gauges work differently
      logger.debug("MCP connection status", { serverName, status, value });
    }
  }

  public recordStartupTime(
    timeMs: number,
    mode?: "tui" | "headless" | "standard",
    coldStart?: boolean,
  ) {
    if (!this.isEnabled()) return;

    const attributes = this.getStandardAttributes();
    if (mode) attributes.mode = mode;
    if (coldStart !== undefined) attributes.cold_start = coldStart.toString();

    this.startupTimeHistogram.record(timeMs, attributes);
  }

  public recordResponseTime(
    timeMs: number,
    model: string,
    metricType: "time_to_first_token" | "total_response_time",
    hasTools?: boolean,
  ) {
    if (!this.isEnabled()) return;

    const attributes = this.getStandardAttributes({
      model,
      metric_type: metricType,
    });
    if (hasTools !== undefined) attributes.has_tools = hasTools.toString();

    this.responseTimeHistogram.record(timeMs, attributes);
  }

  // Event logging methods (these will be implemented when OTLP logs support is added)
  public logUserPrompt(promptLength: number, prompt?: string) {
    if (!this.isEnabled()) return;

    const attributes = this.getStandardAttributes({
      "event.name": "user_prompt",
      "event.timestamp": new Date().toISOString(),
      prompt_length: promptLength.toString(),
    });

    if (process.env.OTEL_LOG_USER_PROMPTS === "1" && prompt) {
      attributes.prompt = prompt;
    }

    // TODO: Implement OTLP logs export
    logger.debug("User prompt event", attributes);
  }

  public logToolResult(options: {
    toolName: string;
    success: boolean;
    durationMs: number;
    error?: string;
    errorReason?: ContinueErrorReason;
    decision?: "accept" | "reject";
    source?: string;
    toolParameters?: string;
    // modelName: string;
  }) {
    if (!this.isEnabled()) return;

    const attributes = this.getStandardAttributes({
      "event.name": "tool_result",
      "event.timestamp": new Date().toISOString(),
      tool_name: options.toolName,
      success: options.success.toString(),
      duration_ms: options.durationMs.toString(),
    });

    if (options.error) attributes.error = options.error;
    if (options.decision) attributes.decision = options.decision;
    if (options.source) attributes.source = options.source;
    if (options.toolParameters)
      attributes.tool_parameters = options.toolParameters;
    if (options.errorReason) {
      attributes.error_reason = options.errorReason;
    }
    if (options.error) {
      attributes.error = options.error;
    }

    // TODO: Implement OTLP logs export
    logger.debug("Tool result event", attributes);
  }

  public logApiRequest(options: {
    model: string;
    durationMs: number;
    success: boolean;
    error?: string;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
  }) {
    if (!this.isEnabled()) return;

    const attributes = this.getStandardAttributes({
      "event.name": "api_request",
      "event.timestamp": new Date().toISOString(),
      model: options.model,
      duration_ms: options.durationMs.toString(),
      success: options.success.toString(),
    });

    if (options.error) attributes.error = options.error;
    if (options.inputTokens)
      attributes.input_tokens = options.inputTokens.toString();
    if (options.outputTokens)
      attributes.output_tokens = options.outputTokens.toString();
    if (options.costUsd) attributes.cost_usd = options.costUsd.toString();

    // TODO: Implement OTLP logs export
    logger.debug("API request event", attributes);
  }

  public updateOrganization(organizationId: string) {
    this.config.organizationId = organizationId;
  }

  public updateAccountUuid(accountUuid: string) {
    this.config.accountUuid = accountUuid;
  }

  public getSessionId(): string {
    return this.config.sessionId;
  }

  public recordSlashCommand(commandName: string) {
    if (!this.isEnabled()) return;

    this.slashCommandCounter.add(
      1,
      this.getStandardAttributes({ command: commandName }),
    );
  }

  /**
   * Shutdown telemetry service and ensure all metrics are flushed
   */
  public async shutdown(): Promise<void> {
    this.stopActiveTime();

    if (this.meterProvider) {
      try {
        logger.debug("Flushing telemetry metrics before shutdown...");
        // Force flush any pending metrics before shutdown
        await this.meterProvider.forceFlush();
        logger.debug("Telemetry metrics flushed successfully");

        // Now shutdown the provider
        await this.meterProvider.shutdown();
        logger.debug("Telemetry service shut down successfully");
      } catch (error) {
        logger.error("Failed to shutdown telemetry service", error);
      }
    }
  }
}

// Export the singleton instance directly
export const telemetryService = new TelemetryService();
