import {
  FeatureFlagCache,
  FeatureFlagCacheEntry,
  GlobalContext,
} from "./GlobalContext";

import os from "node:os";

import { TeamAnalytics } from "../control-plane/TeamAnalytics.js";
import { IdeInfo } from "../index.js";

import type { PostHog as PostHogType } from "posthog-node";

export enum PosthogFeatureFlag {
  AutocompleteTimeout = "autocomplete-timeout",
  RecentlyVisitedRangesNumSurroundingLines = "recently-visited-ranges-num-surrounding-lines",
}

export const EXPERIMENTS: {
  [key in PosthogFeatureFlag]: {
    [key: string]: { value: any };
  };
} = {
  [PosthogFeatureFlag.AutocompleteTimeout]: {
    control: { value: 150 },
    "250": { value: 250 },
    "350": { value: 350 },
    "450": { value: 450 },
  },
  [PosthogFeatureFlag.RecentlyVisitedRangesNumSurroundingLines]: {
    control: { value: null },
    "5": { value: 5 },
    "10": { value: 10 },
    "15": { value: 15 },
    "20": { value: 20 },
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

  private static featureValueCache: Record<string, any> = {};
  private static globalContext = new GlobalContext();

  private static shouldRefreshFlag(flag: PosthogFeatureFlag): boolean {
    const cache = Telemetry.globalContext.get("featureFlagCache");
    if (!cache?.flags[flag]) return true;

    const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const now = Date.now();
    return now - cache.flags[flag].lastUpdated > ONE_DAY;
  }

  private static async updateFlagCache(flag: PosthogFeatureFlag, value: any) {
    const cache = Telemetry.globalContext.get("featureFlagCache") || {
      flags: {},
    };

    const newEntry: FeatureFlagCacheEntry = {
      lastUpdated: Date.now(),
      value,
    };

    const updatedCache: FeatureFlagCache = {
      flags: {
        ...cache.flags,
        [flag]: newEntry,
      },
    };

    Telemetry.globalContext.update("featureFlagCache", updatedCache);
    Telemetry.featureValueCache[flag] = value;
  }

  static async getValueForFeatureFlag(flag: PosthogFeatureFlag) {
    try {
      // Check if we have a valid cached value
      const cache = Telemetry.globalContext.get("featureFlagCache");
      if (cache?.flags[flag] && !Telemetry.shouldRefreshFlag(flag)) {
        return cache.flags[flag].value;
      }

      // If we need to refresh, get the new value
      const userGroup = await Telemetry.getFeatureFlag(flag);
      if (typeof userGroup === "string") {
        const value = EXPERIMENTS[flag][userGroup].value;
        await Telemetry.updateFlagCache(flag, value);
        return value;
      }

      // If no value is found, cache undefined to prevent repeated lookups
      await Telemetry.updateFlagCache(flag, undefined);
      return undefined;
    } catch {
      return undefined;
    }
  }

  // The getFeatureFlag method can remain unchanged
  static async getFeatureFlag(flag: PosthogFeatureFlag) {
    const value = Telemetry.client?.getFeatureFlag(flag, Telemetry.uniqueId);
    return value;
  }
}
