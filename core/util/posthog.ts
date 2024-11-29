import os from "node:os";

import { TeamAnalytics } from "../control-plane/TeamAnalytics.js";
import { IdeInfo } from "../index.js";
import type { PostHog as PostHogType } from "posthog-node";

export enum PosthogFeatureFlag {
  AutocompleteTemperature = "autocomplete-temperature",
}

export const EXPERIMENTS: {
  [key in PosthogFeatureFlag]: {
    [key: string]: { value: number };
  };
} = {
  [PosthogFeatureFlag.AutocompleteTemperature]: {
    control: { value: 0.01 },
    "0_33": { value: 0.33 },
    "0_66": { value: 0.66 },
    "0_99": { value: 0.99 },
  },
};

export class Telemetry {
  // Set to undefined whenever telemetry is disabled
  static client: PostHogType | undefined = undefined;
  static uniqueId = "NOT_UNIQUE";
  static os: string | undefined = undefined;
  static ideInfo: IdeInfo | undefined = undefined;

  static async capture(
    event: string,
    properties: { [key: string]: any },
    sendToTeam: boolean = false,
    isExtensionActivationError: boolean = false,
  ) {
    try {
      const augmentedProperties = {
        ...properties,
        os: Telemetry.os,
        extensionVersion: Telemetry.ideInfo?.extensionVersion,
        ideName: Telemetry.ideInfo?.name,
        ideType: Telemetry.ideInfo?.ideType,
      };
      const payload = {
        distinctId: Telemetry.uniqueId,
        event,
        properties: augmentedProperties,
        sendFeatureFlags: true,
      };

      // In cases where an extremely early fatal error occurs, we may not have initialized yet
      if (isExtensionActivationError && !Telemetry.client) {
        const client = await Telemetry.getTelemetryClient();
        client?.capture(payload);
        return;
      }

      if (process.env.NODE_ENV === "test") {
        return;
      }

      Telemetry.client?.capture(payload);

      if (sendToTeam) {
        void TeamAnalytics.capture(event, properties);
      }
    } catch (e) {
      console.error(`Failed to capture event: ${e}`);
    }
  }

  static shutdownPosthogClient() {
    Telemetry.client?.shutdown();
  }

  static async getTelemetryClient(): Promise<PostHogType | undefined> {
    try {
      const { PostHog } = await import("posthog-node");
      return new PostHog("phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs", {
        host: "https://app.posthog.com",
      });
    } catch (e) {
      console.error(`Failed to setup telemetry: ${e}`);
    }
  }

  static async setup(allow: boolean, uniqueId: string, ideInfo: IdeInfo) {
    Telemetry.uniqueId = uniqueId;
    Telemetry.os = os.platform();
    Telemetry.ideInfo = ideInfo;

    if (!allow || process.env.NODE_ENV === "test") {
      Telemetry.client = undefined;
    } else if (!Telemetry.client) {
      Telemetry.client = await Telemetry.getTelemetryClient();
    }
  }

  static async getFeatureFlag(flag: PosthogFeatureFlag) {
    return Telemetry.client?.getFeatureFlag(flag, Telemetry.uniqueId);
  }

  static async getValueForFeatureFlag(flag: PosthogFeatureFlag) {
    const userGroup = await Telemetry.getFeatureFlag(flag);
    if (typeof userGroup === "string") {
      return EXPERIMENTS[flag][userGroup].value;
    }

    return undefined;
  }
}
