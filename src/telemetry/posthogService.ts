import os from "node:os";

import type { PostHog as PostHogType } from "posthog-node";

export class PosthogService {
  private os: string | undefined;
  private uniqueId: string;

  constructor() {
    this.os = os.platform();
    this.uniqueId = "NOT_UNIQUE";
  }

  get isEnabled() {
    return process.env.CONTINUE_CLI_ENABLE_TELEMETRY !== "0";
  }

  private _client: PostHogType | undefined;
  private async getClient() {
    if (this.isEnabled) {
      if (!this._client) {
        const { PostHog } = await import("posthog-node");
        this._client = new PostHog(
          "phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs",
          {
            host: "https://app.posthog.com",
          },
        );
      }
    } else {
      this._client = undefined;
    }
    return this._client;
  }

  async capture(event: string, properties: { [key: string]: any }) {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    try {
      const augmentedProperties = {
        ...properties,
        os: this.os,
        extensionVersion: "", // TODO cn version
        ideName: "cn",
        ideType: "cli",
      };
      const payload = {
        distinctId: this.uniqueId,
        event,
        properties: augmentedProperties,
        sendFeatureFlags: true,
      };

      client?.capture(payload);
    } catch (e) {
      console.error(`Failed to capture event: ${e}`);
    }
  }

  async shutdown() {
    const client = await this.getClient();
    client?.shutdown();
  }
}

export const posthogService = new PosthogService();
