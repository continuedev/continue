import { Analytics } from "@continuedev/config-types";
import os from "node:os";
import { IAnalyticsProvider } from "./analytics/IAnalyticsProvider";
import PostHogAnalyticsProvider from "./analytics/PostHogAnalyticsProvider";

function createAnalyticsProvider(
  config: Analytics,
): IAnalyticsProvider | undefined {
  // @ts-ignore
  switch (config.provider) {
    case "posthog":
      return new PostHogAnalyticsProvider();
    default:
      return undefined;
  }
}

export class TeamAnalytics {
  static provider: IAnalyticsProvider | undefined = undefined;
  static uniqueId = "NOT_UNIQUE";
  static os: string | undefined = undefined;
  static extensionVersion: string | undefined = undefined;

  static async capture(event: string, properties: { [key: string]: any }) {
    TeamAnalytics.provider?.capture(event, {
      ...properties,
      os: TeamAnalytics.os,
      extensionVersion: TeamAnalytics.extensionVersion,
    });
  }

  static async setup(
    config: Analytics,
    uniqueId: string,
    extensionVersion: string,
  ) {
    TeamAnalytics.uniqueId = uniqueId;
    TeamAnalytics.os = os.platform();
    TeamAnalytics.extensionVersion = extensionVersion;

    if (!config) {
      await TeamAnalytics.provider?.shutdown();
      TeamAnalytics.provider = undefined;
    } else {
      TeamAnalytics.provider = createAnalyticsProvider(config);
      await TeamAnalytics.provider?.setup(config, uniqueId);
    }
  }
}
