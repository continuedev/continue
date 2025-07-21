import * as Sentry from "@sentry/node";
import { IdeInfo } from "../index.js";

export class SentryLogger {
  // Set to undefined whenever telemetry is disabled
  static client: typeof Sentry | undefined = undefined;
  static logger: typeof Sentry.logger | undefined = undefined;
  static uniqueId = "NOT_UNIQUE";
  static os: string | undefined = undefined;
  static ideInfo: IdeInfo | undefined = undefined;
  static allowTelemetry: boolean = false;

  private static initializeSentryClient(release: string) {
    Sentry.init({
      release,
      dsn: "https://fe99934dcdc537d84209893a3f96a196@o4505462064283648.ingest.us.sentry.io/4508184596054016",
      environment: process.env.NODE_ENV,

      // Enable tracing for performance monitoring
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

      // Enable structured logging
      _experiments: {
        enableLogs: true,
      },

      // Capture console.error and console.warn as logs in Sentry
      integrations: [
        Sentry.consoleLoggingIntegration({ levels: ["error", "warn"] }),
      ],

      // TODO: Hub info, e.g. username
      initialScope: {},
    });

    return Sentry;
  }

  static async setup(allow: boolean, uniqueId: string, ideInfo: IdeInfo) {
    SentryLogger.allowTelemetry = allow && process.env.NODE_ENV !== "test";
    SentryLogger.uniqueId = uniqueId;
    SentryLogger.ideInfo = ideInfo;

    if (!SentryLogger.allowTelemetry) {
      SentryLogger.client = undefined;
      SentryLogger.logger = undefined;
    } else if (!SentryLogger.client) {
      SentryLogger.client = SentryLogger.initializeSentryClient(
        ideInfo.extensionVersion,
      );
      SentryLogger.logger = SentryLogger.client.logger;
    }
  }

  private static ensureInitialized(): void {
    if (!SentryLogger.allowTelemetry || SentryLogger.client) {
      return;
    }

    if (SentryLogger.ideInfo) {
      SentryLogger.client = SentryLogger.initializeSentryClient(
        SentryLogger.ideInfo.extensionVersion,
      );
      SentryLogger.logger = SentryLogger.client.logger;
    }
  }

  static get lazyLogger(): typeof Sentry.logger | undefined {
    SentryLogger.ensureInitialized();
    return SentryLogger.logger;
  }

  static shutdownSentryClient() {
    if (SentryLogger.client) {
      void SentryLogger.client.close();
      SentryLogger.client = undefined;
      SentryLogger.logger = undefined;
    }
  }
}

/**
 * Initialize Sentry for error tracking, performance monitoring, and structured logging.
 * Returns the Sentry client and logger, or undefined objects if telemetry is disabled.
 */
export function initializeSentry(): {
  Sentry: typeof Sentry | undefined;
  logger: typeof Sentry.logger | undefined;
} {
  return {
    Sentry: SentryLogger.client,
    logger: SentryLogger.client?.logger,
  };
}

// Export utility functions for using Sentry throughout the application

/**
 * Create a custom span for performance monitoring
 *
 * @param operation The operation category (e.g., "http.client", "ui.click", "db.query")
 * @param name A descriptive name for the span
 * @param callback The function to execute within the span
 * @returns The result of the callback function
 */
export function createSpan<T>(
  operation: string,
  name: string,
  callback: () => T | Promise<T>,
): T | Promise<T> {
  if (!SentryLogger.client) {
    return callback();
  }

  return SentryLogger.client.startSpan(
    {
      op: operation,
      name,
    },
    () => callback(),
  );
}

/**
 * Capture an exception and send it to Sentry
 *
 * @param error The error to capture
 * @param context Additional context information
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (!SentryLogger.client) {
    return;
  }

  try {
    SentryLogger.client.captureException(error, { extra: context });
  } catch (e) {
    console.error(`Failed to capture exception to Sentry: ${e}`);
  }
}
