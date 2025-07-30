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
      // For shared environments like VSCode extensions, we need to be careful
      // Using Sentry.init() but with limited integrations to avoid global state pollution
      Sentry.init({
        dsn: SENTRY_DSN,
        release,
        environment: process.env.NODE_ENV,
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

        // Strip sensitive data and add basic properties before sending events
        beforeSend(event) {
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

        // Minimal integrations for Node.js/VSCode shared environment
        integrations: [
          // Keep only essential integrations
          Sentry.nodeContextIntegration(),
          Sentry.functionToStringIntegration(),
          Sentry.linkedErrorsIntegration({ key: "cause", limit: 5 }),
          Sentry.modulesIntegration(),
        ],

        // Enable structured logging
        _experiments: {
          enableLogs: true,
        },

        // Don't automatically capture unhandled rejections - we'll do this manually
      });

      // Get the initialized client and create a new scope
      const client = Sentry.getClient() as Sentry.NodeClient | undefined;
      const scope = new Sentry.Scope();

      return { client, scope };
    } catch (error) {
      console.error("Failed to initialize Sentry client:", error);
      return { client: undefined, scope: undefined };
    }
  }

  static async setup(
    allow: boolean,
    uniqueId: string,
    ideInfo: IdeInfo,
    userEmail?: string,
  ) {
    // TODO: Remove Continue team member check once Sentry is ready for all users
    const isContinueTeam = isContinueTeamMember(userEmail);
    
    // Disable Sentry in debug mode, test environments, or when telemetry is disabled
    const isDebugMode = process.env.CONTINUE_DEVELOPMENT === "true";
    const isTestEnv = process.env.NODE_ENV === "test";
    
    SentryLogger.allowTelemetry =
      allow && !isTestEnv && !isDebugMode && isContinueTeam;
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
  if (!SentryLogger.lazyClient) {
    return callback();
  }

  // Use Sentry's startSpan function
  return Sentry.startSpan(
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
  if (!SentryLogger.lazyClient) {
    return;
  }

  try {
    // Use Sentry's global captureException with context
    Sentry.captureException(error, { extra: context });
  } catch (e) {
    console.error(`Failed to capture exception to Sentry: ${e}`);
  }
}
