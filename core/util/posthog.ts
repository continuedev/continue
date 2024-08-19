import os from "node:os";
import { TeamAnalytics } from "../control-plane/TeamAnalytics.js";
import { IdeInfo } from "../index.js";

export class Telemetry {
  // Set to undefined whenever telemetry is disabled
  static client: any = undefined;
  static uniqueId = "NOT_UNIQUE";
  static os: string | undefined = undefined;
  static ideInfo: IdeInfo | undefined = undefined;

  static async capture(
    event: string,
    properties: { [key: string]: any },
    sendToTeam: boolean = false,
  ) {
    Telemetry.client?.capture({
      distinctId: Telemetry.uniqueId,
      event,
      properties: {
        ...properties,
        os: Telemetry.os,
        extensionVersion: Telemetry.ideInfo?.extensionVersion,
        ideName: Telemetry.ideInfo?.name,
        ideType: Telemetry.ideInfo?.ideType,
      },
    });

    if (sendToTeam) {
      TeamAnalytics.capture(event, properties);
    }
  }

  static shutdownPosthogClient() {
    Telemetry.client?.shutdown();
  }

  static async setup(allow: boolean, uniqueId: string, ideInfo: IdeInfo) {
    Telemetry.uniqueId = uniqueId;
    Telemetry.os = os.platform();
    Telemetry.ideInfo = ideInfo;

    if (!allow) {
      Telemetry.client = undefined;
    } else {
      try {
        if (!Telemetry.client) {
          const { PostHog } = await import("posthog-node");
          Telemetry.client = new PostHog(
            "phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs",
            {
              host: "https://app.posthog.com",
            },
          );
        }
      } catch (e) {
        console.error(`Failed to setup telemetry: ${e}`);
      }
    }
  }
}
