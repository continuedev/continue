import * as Sentry from "@sentry/node";

import {
  getProfilingIntegration,
  isProfilingAvailable,
} from "./sentry-profiling.js";
import { logger } from "./util/logger.js";
import { getVersion } from "./version.js";

interface SentryConfig {
  enabled: boolean;
  dsn?: string;
  environment: string;
  release: string;
  sampleRate: number;
  profilesSampleRate: number;
  tracesSampleRate: number;
}

class SentryService {
  private config: SentryConfig;
  private initialized = false;

  constructor() {
    this.config = this.loadConfig();
    if (this.config.enabled) {
      this.initialize();
    }
  }

  private loadConfig(): SentryConfig {
    const enabled =
      process.env.SENTRY_ENABLED !== "false" && !!process.env.SENTRY_DSN;

    return {
      enabled,
      dsn: process.env.SENTRY_DSN,
      environment:
        process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
      release: getVersion(),
      sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || "1.0"),
      profilesSampleRate: parseFloat(
        process.env.SENTRY_PROFILES_SAMPLE_RATE || "1.0",
      ),
      tracesSampleRate: parseFloat(
        process.env.SENTRY_TRACES_SAMPLE_RATE || "1.0",
      ),
    };
  }

  private async initialize() {
    if (this.initialized || !this.config.dsn) {
      return;
    }

    try {
      const integrations = [];
      const profilingIntegration = await getProfilingIntegration();
      if (
        profilingIntegration &&
        Object.keys(profilingIntegration).length > 0
      ) {
        integrations.push(profilingIntegration);
      }

      Sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment,
        release: this.config.release,
        sampleRate: this.config.sampleRate,
        profilesSampleRate: this.config.profilesSampleRate,
        tracesSampleRate: this.config.tracesSampleRate,
        integrations,
        beforeSend(event) {
          // Filter out certain error types if needed
          if (event.exception?.values?.[0]?.type === "AbortError") {
            return null;
          }
          return event;
        },
      });

      this.initialized = true;
      logger.debug("Sentry initialized", {
        environment: this.config.environment,
        release: this.config.release,
        profilingAvailable: await isProfilingAvailable(),
      });
    } catch (error) {
      logger.error("Failed to initialize Sentry", error);
    }
  }

  public isEnabled(): boolean {
    return this.config.enabled && this.initialized;
  }

  public captureException(
    error: Error,
    context?: Record<string, any>,
    level?: "info" | "warning" | "error" | "debug" | "fatal",
  ) {
    if (!this.isEnabled()) return;

    Sentry.withScope((scope) => {
      if (level) {
        scope.setLevel(level);
      }
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
      }
      Sentry.captureException(error);
    });
  }

  public captureMessage(
    message: string,
    level: "info" | "warning" | "error" | "debug" | "fatal" = "info",
    context?: Record<string, any>,
  ) {
    if (!this.isEnabled()) return;

    Sentry.withScope((scope) => {
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
      }
      Sentry.captureMessage(message, level);
    });
  }

  public setUser(user: { id?: string; email?: string; username?: string }) {
    if (!this.isEnabled()) return;

    Sentry.setUser(user);
  }

  public setTag(key: string, value: string) {
    if (!this.isEnabled()) return;

    Sentry.setTag(key, value);
  }

  public setContext(key: string, context: Record<string, any>) {
    if (!this.isEnabled()) return;

    Sentry.setContext(key, context);
  }

  public addBreadcrumb(breadcrumb: {
    message: string;
    category?: string;
    level?: "fatal" | "error" | "warning" | "log" | "info" | "debug";
    data?: Record<string, any>;
  }) {
    if (!this.isEnabled()) return;

    Sentry.addBreadcrumb(breadcrumb);
  }

  public startSpan(name: string, op?: string) {
    if (!this.isEnabled()) return null;

    return Sentry.startSpan({ name, op }, (span) => span);
  }

  public async flush(timeout = 2000): Promise<boolean> {
    if (!this.isEnabled()) return true;

    return await Sentry.flush(timeout);
  }

  public async close(timeout = 2000): Promise<boolean> {
    if (!this.isEnabled()) return true;

    return await Sentry.close(timeout);
  }
}

export const sentryService = new SentryService();
