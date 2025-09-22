import { Extras, type Integration, type Event } from "@sentry/core";
import * as Sentry from "@sentry/node";
import os from "node:os";
import { IdeInfo } from "../../index.js";
import { isContinueTeamMember } from "../isContinueTeamMember.js";
import { anonymizeSentryEvent } from "./anonymization.js";
import { SENTRY_DSN } from "./constants.js";

export class SentryLogger {
  static client: Sentry.NodeClient | undefined = undefined;
  static scope: Sentry.Scope | undefined = undefined;
  static uniqueId = "NOT_UNIQUE";
  static os: string | undefined = undefined;
  static ideInfo: IdeInfo | undefined = undefined;
  static allowTelemetry: boolean = false;

  private static initializeSentryClient(release: string): {
    client: Sentry.NodeClient | undefined;
    scope: Sentry.Scope | undefined;
  } {
    try {
      // For shared environments like VSCode extensions, we need to avoid global state pollution
      // Filter out integrations that use global state
      // See https://docs.sentry.io/platforms/javascript/best-practices/shared-environments/

      // Filter integrations that use the global variable
      const integrations = Sentry.getDefaultIntegrations({}).filter(
        (defaultIntegration: Integration) => {
          // Remove integrations that might interfere with shared environments
          return ![
            "OnUncaughtException",
            "OnUnhandledRejection",
            "ContextLines",
            "LocalVariables",
          ].includes(defaultIntegration.name);
        },
      );

      // Create client manually without polluting global state
      const client = new Sentry.NodeClient({
        dsn: SENTRY_DSN,
        release,
        environment: process.env.NODE_ENV,
        transport: Sentry.makeNodeTransport,
        stackParser: Sentry.defaultStackParser,

        // For basic error tracking, a lower sample rate should be fine
        sampleRate: 0.1,
        tracesSampleRate: 0.1,

        // Privacy-conscious default
        sendDefaultPii: false,

        // Strip sensitive data and add basic properties before sending events
        beforeSend(event: Event) {
          // First apply anonymization
          const anonymizedEvent = anonymizeSentryEvent(event);
          if (!anonymizedEvent) return null;

          // Add basic properties similar to PostHog telemetry
          if (!anonymizedEvent.tags) anonymizedEvent.tags = {};
          if (!anonymizedEvent.extra) anonymizedEvent.extra = {};

          // Add OS information
          if (SentryLogger.os) {
            anonymizedEvent.tags.os = SentryLogger.os;
          }

          // Add ideInfo properties spread out as top-level properties
          if (SentryLogger.ideInfo) {
            anonymizedEvent.tags.extensionVersion =
              SentryLogger.ideInfo.extensionVersion;
            anonymizedEvent.tags.ideName = SentryLogger.ideInfo.name;
            anonymizedEvent.tags.ideType = SentryLogger.ideInfo.ideType;
            anonymizedEvent.tags.ideVersion = SentryLogger.ideInfo.version;
            anonymizedEvent.tags.remoteName = SentryLogger.ideInfo.remoteName;
            anonymizedEvent.tags.isPrerelease =
              SentryLogger.ideInfo.isPrerelease;
          }

          return anonymizedEvent;
        },

        // Use filtered integrations for Node.js/VSCode shared environment
        integrations,

        // Enable structured logging
        _experiments: {
          enableLogs: true,
        },
      });

      // Create a new scope and set the client
      const scope = new Sentry.Scope();
      scope.setClient(client);

      // Initialize the client after setting it on the scope
      client.init();

      return { client, scope };
    } catch (error) {
      console.error("Failed to initialize Sentry client:", error);
      return { client: undefined, scope: undefined };
    }
  }

  static async setup(
    allowAnonymousTelemetry: boolean,
    uniqueId: string,
    ideInfo: IdeInfo,
    userEmail?: string,
  ) {
    // TODO: Remove Continue team member check once Sentry is ready for all users
    SentryLogger.allowTelemetry =
      allowAnonymousTelemetry && isContinueTeamMember(userEmail);
    SentryLogger.uniqueId = uniqueId;
    SentryLogger.ideInfo = ideInfo;
    SentryLogger.os = os.platform();

    if (!SentryLogger.allowTelemetry) {
      SentryLogger.client = undefined;
      SentryLogger.scope = undefined;
    } else if (!SentryLogger.client) {
      const { client, scope } = SentryLogger.initializeSentryClient(
        ideInfo.extensionVersion,
      );
      SentryLogger.client = client;
      SentryLogger.scope = scope;
    }
  }

  private static ensureInitialized(): void {
    if (!SentryLogger.allowTelemetry || SentryLogger.client) {
      return;
    }

    if (SentryLogger.ideInfo) {
      const { client, scope } = SentryLogger.initializeSentryClient(
        SentryLogger.ideInfo.extensionVersion,
      );
      SentryLogger.client = client;
      SentryLogger.scope = scope;
    }
  }

  static get lazyClient(): Sentry.NodeClient | undefined {
    SentryLogger.ensureInitialized();
    return SentryLogger.client;
  }

  static get lazyScope(): Sentry.Scope | undefined {
    SentryLogger.ensureInitialized();
    return SentryLogger.scope;
  }

  static shutdownSentryClient() {
    if (SentryLogger.client) {
      void SentryLogger.client.close();
      SentryLogger.client = undefined;
      SentryLogger.scope = undefined;
    }
  }
}

/**
 * Initialize Sentry for error tracking, performance monitoring, and structured logging.
 * Returns the Sentry client and scope, or undefined objects if telemetry is disabled.
 */
export function initializeSentry(): {
  client: Sentry.NodeClient | undefined;
  scope: Sentry.Scope | undefined;
} {
  return {
    client: SentryLogger.lazyClient,
    scope: SentryLogger.lazyScope,
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
  const client = SentryLogger.lazyClient;
  if (!client) {
    return callback();
  }

  // Use withScope from Sentry to isolate the span context
  return Sentry.withScope((isolatedScope: Sentry.Scope) => {
    isolatedScope.setClient(client);
    return Sentry.startSpan(
      {
        op: operation,
        name,
      },
      () => callback(),
    );
  });
}

/**
 * Capture an exception and send it to Sentry
 *
 * @param error The error to capture
 * @param context Additional context information
 */
export function captureException(error: Error, context?: Record<string, any>) {
  const scope = SentryLogger.lazyScope;
  if (!scope) {
    return;
  }

  try {
    // Add context to scope if provided
    if (context) {
      scope.setExtras(context);
    }
    // Use scope's captureException to avoid global state
    scope.captureException(error);
  } catch (e) {
    console.error(`Failed to capture exception to Sentry: ${e}`);
  }
}

/**
 * Capture a structured log message and send it to Sentry
 *
 * @param message The log message
 * @param level The severity level (default: 'info')
 * @param context Additional context information
 */
export function captureLog(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: Extras,
) {
  const scope = SentryLogger.lazyScope;
  if (!scope) {
    return;
  }

  try {
    // Add context to scope if provided
    if (context) {
      scope.setExtras(context);
    }
    // Use scope's captureMessage to avoid global state
    scope.captureMessage(message, level);
  } catch (e) {
    console.error(`Failed to capture log to Sentry: ${e}`);
  }
}
