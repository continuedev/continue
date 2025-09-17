import dns from "dns/promises";
import os from "node:os";

import node_machine_id from "node-machine-id";
import type { PostHog as PostHogType } from "posthog-node";

import { isAuthenticatedConfig, loadAuthConfig } from "../auth/workos.js";
import { isHeadlessMode } from "../util/cli.js";
import { isGitHubActions } from "../util/git.js";
import { logger } from "../util/logger.js";
import { getVersion } from "../version.js";

export class PosthogService {
  private os: string | undefined;
  private uniqueId: string;

  constructor() {
    this.os = os.platform();
    this.uniqueId = this.getEventUserId();
  }

  private _hasInternetConnection: boolean | undefined = undefined;
  private async hasInternetConnection() {
    const refetchConnection = async () => {
      try {
        await dns.lookup("app.posthog.com");
        this._hasInternetConnection = true;
      } catch {
        this._hasInternetConnection = false;
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
    return process.env.CONTINUE_CLI_ENABLE_TELEMETRY !== "0";
  }

  private _client: PostHogType | undefined;
  private async getClient() {
    if (!(await this.hasInternetConnection())) {
      this._client = undefined;
      logger.warn("No internet connection, skipping telemetry");
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
   * - Continue user id if signed in
   * - Unique machine id if not signed in
   */
  private getEventUserId(): string {
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
