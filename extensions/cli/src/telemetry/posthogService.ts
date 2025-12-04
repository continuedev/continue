import dns from "dns/promises";
import os from "node:os";

import node_machine_id from "node-machine-id";
import type { PostHog as PostHogType } from "posthog-node";

import { isAuthenticatedConfig, loadAuthConfig } from "../auth/workos.js";
import { loggers } from "../logging.js";
import { isHeadlessMode, isServe } from "../util/cli.js";
import { isGitHubActions } from "../util/git.js";
import { logger } from "../util/logger.js";
import { getVersion } from "../version.js";

export class PosthogService {
  private _os: string | undefined;
  private _uniqueId: string | undefined;
  private _telemetryBlocked: boolean = false;

  constructor() {
    // Initialization is now lazy to avoid issues with mocking in tests
  }

  private get os(): string {
    if (!this._os) {
      this._os = os.platform();
    }
    return this._os;
  }

  public get uniqueId(): string {
    if (!this._uniqueId) {
      this._uniqueId = this.getEventUserId();
    }
    return this._uniqueId;
  }

  private _hasInternetConnection: boolean | undefined = undefined;
  private async hasInternetConnection() {
    const refetchConnection = async () => {
      try {
        const result = await dns.lookup("app.posthog.com");
        const isValidAddress =
          result.address !== "0.0.0.0" && !result.address.startsWith("127.");
        this._hasInternetConnection = isValidAddress;
        this._telemetryBlocked = !isValidAddress;
        if (!isValidAddress) {
          logger.debug(
            "DNS lookup returned invalid address for PostHog, skipping telemetry",
          );
        }
      } catch {
        this._hasInternetConnection = false;
        this._telemetryBlocked = false;
      }
    };

    if (typeof this._hasInternetConnection !== "undefined") {
      void refetchConnection(); // check in background if connection became available
      return this._hasInternetConnection;
    }

    await refetchConnection();
    return this._hasInternetConnection;
  }

  get isEnabled() {
    if (process.env.CONTINUE_TELEMETRY_ENABLED === "0") {
      return false;
    }
    if (process.env.CONTINUE_TELEMETRY_ENABLED === "1") {
      return true;
    }
    return process.env.CONTINUE_ALLOW_ANONYMOUS_TELEMETRY !== "0";
  }

  private _client: PostHogType | undefined;
  private async getClient() {
    if (!(await this.hasInternetConnection())) {
      this._client = undefined;
      if (this._telemetryBlocked && this.isEnabled) {
        loggers.warning(
          "Telemetry appears to be blocked by your network. To disable telemetry entirely, set CONTINUE_TELEMETRY_ENABLED=0",
        );
      } else if (this.isEnabled) {
        logger.warn("No internet connection, skipping telemetry");
      }
    } else if (this.isEnabled) {
      if (!this._client) {
        const { PostHog } = await import("posthog-node");
        this._client = new PostHog(
          "phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs",
          {
            host: "https://app.posthog.com",
          },
        );
        logger.debug("Initialized telemetry");
      }
    } else {
      this._client = undefined;
    }
    return this._client;
  }

  /**
   * - Continue user id from environment (when running as agent)
   * - Continue user id if signed in locally
   * - Unique machine id if not signed in
   */
  private getEventUserId(): string {
    // When running as an agent, use the user ID from the environment
    if (process.env.CONTINUE_USER_ID) {
      return process.env.CONTINUE_USER_ID;
    }

    const authConfig = loadAuthConfig();

    if (isAuthenticatedConfig(authConfig)) {
      return authConfig.userId;
    }

    // Fall back to unique machine id if not signed in
    return node_machine_id.machineIdSync();
  }

  async capture(event: string, properties: { [key: string]: any }) {
    try {
      const client = await this.getClient();
      if (!client) {
        return;
      }

      const augmentedProperties = {
        ...properties,
        os: this.os,
        extensionVersion: getVersion(),
        ideName: "cn",
        ideType: "cli",
        isHeadless: isHeadlessMode(),
        isGitHubCI: isGitHubActions(),
        isServe: isServe(),
      };
      const payload = {
        distinctId: this.uniqueId,
        event,
        properties: augmentedProperties,
        sendFeatureFlags: true,
      };

      client?.capture(payload);
    } catch (e) {
      logger.debug(`Failed to capture telemetry event '${event}': ${e}`);
    }
  }

  async shutdown() {
    try {
      const client = await this.getClient();
      if (client) {
        // Set a timeout for shutdown to prevent hanging
        const shutdownPromise = client.shutdown();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Shutdown timeout")), 5000),
        );

        await Promise.race([shutdownPromise, timeoutPromise]);
      }
    } catch (e) {
      logger.debug(`Failed to shutdown PostHog client: ${e}`);
    }
  }
}

export const posthogService = new PosthogService();
