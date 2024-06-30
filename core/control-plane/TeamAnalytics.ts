import os from "node:os";
import { ControlPlaneAnalytics } from "./schema";

export class TeamAnalytics {
  static client: any = undefined;
  static uniqueId = "NOT_UNIQUE";
  static os: string | undefined = undefined;
  static extensionVersion: string | undefined = undefined;

  static async capture(event: string, properties: { [key: string]: any }) {
    TeamAnalytics.client?.capture({
      distinctId: TeamAnalytics.uniqueId,
      event,
      properties: {
        ...properties,
        os: TeamAnalytics.os,
        extensionVersion: TeamAnalytics.extensionVersion,
      },
    });
  }

  static shutdownPosthogClient() {
    TeamAnalytics.client?.shutdown();
  }

  static async setup(
    config: ControlPlaneAnalytics,
    uniqueId: string,
    extensionVersion: string,
  ) {
    TeamAnalytics.uniqueId = uniqueId;
    TeamAnalytics.os = os.platform();
    TeamAnalytics.extensionVersion = extensionVersion;

    if (!config || !config.clientKey || !config.url) {
      TeamAnalytics.client = undefined;
    } else {
      try {
        const { PostHog } = await import("posthog-node");
        TeamAnalytics.client = new PostHog(config.clientKey, {
          host: config.url,
        });
      } catch (e) {
        console.error(`Failed to setup telemetry: ${e}`);
      }
    }
  }
}
